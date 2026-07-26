/**
 * Account deletion — the two-system erasure (ticket 09 / ADR-0010).
 *
 *   POST /account/delete {token}   Spend a one-time deletion token minted by the
 *                                  OAuth callback, and erase the account from BOTH
 *                                  our database and PostHog.
 *
 * ADR-0010 records that "erasure is now a two-system operation … a GDPR obligation,
 * not housekeeping". Until this shipped there was no deletion path in the codebase at
 * all and /privacy truthfully said so, which made erasure a manual operator job with
 * no runbook and no guarantee the PostHog half ever happened.
 *
 * **Why a token rather than the bearer every other gated route uses.** The website
 * sign-in mints no token at all (ADR-0001: the exchange runs server-side and hands
 * back a fragment, never a credential), so a website-only user — the common case for
 * the join flow — has nothing to authenticate a `DELETE` with. Sending them through
 * GitHub proves who they are with the machinery that already exists. But that leg
 * cannot itself be the deletion: GitHub re-authorizes an already-approved app with no
 * user interaction, so a bare link to `…/auth/web/start?intent=delete` would be a
 * one-click account wipe for anyone who could be talked into clicking it. So the
 * callback only mints a short-lived token, and the irreversible half waits here,
 * behind an explicit confirmation the site collects.
 */

import { deletePerson, type Tracker } from "./analytics";

/**
 * Erase everything keyed to one `github_id`, in both systems.
 *
 * **PostHog first, our rows second, and never the other way round.** The two orders
 * fail very differently. Deleting our rows first and then failing at PostHog leaves a
 * person profile keyed to a `github_id` whose account is gone — the exact outcome the
 * obligation forbids — and it is unrecoverable, because the rows that said who that
 * person was are what we just deleted. In this order a PostHog failure leaves the
 * account whole and retryable, and a database failure leaves the profile already gone
 * and the retry harmless (a distinct id matching nobody is a successful no-op).
 *
 * Idempotent by construction: deleting an account that is already gone deletes zero
 * rows and finds zero persons, which is a success, not an error. That is what lets a
 * retry finish a deletion that failed halfway.
 */
export async function deleteAccount(env: Env, githubId: number): Promise<void> {
  await deletePerson(env, String(githubId));

  // Children before parents, so the FK edges into users(github_id) are gone before
  // the row they point at. `pending_auth` is in the list because ticket 07 put a
  // github_id on it: an in-flight sign-in row holds a raw bearer token, a login and
  // an email, and leaving one behind would survive the account it belongs to.
  //
  // One batch is one transaction: either every table loses the account or none does,
  // so there is no state where the token outlives the user row that authorizes it.
  await env.CATALOG.batch(
    [
      "DELETE FROM subscriptions WHERE github_id = ?",
      "DELETE FROM tokens WHERE github_id = ?",
      "DELETE FROM pending_auth WHERE github_id = ?",
      "DELETE FROM users WHERE github_id = ?",
    ].map((sql) => env.CATALOG.prepare(sql).bind(githubId)),
  );
}

/** POST /account/delete {token} — spend a one-time deletion token from the OAuth return. */
export async function handleAccountDelete(env: Env, req: Request, track: Tracker): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return Response.json({ error: "token is required" }, { status: 400 });

  // `intent = 'delete'` is part of the lookup, not a check after it: a sign-in
  // handoff row also carries a raw token in this column, and matching one of those
  // would let a token minted for logging in be spent on deleting the account.
  const row = await env.CATALOG.prepare(
    "SELECT github_id, expires_at FROM pending_auth WHERE token = ? AND intent = 'delete'",
  )
    .bind(token)
    .first<{ github_id: number | null; expires_at: string }>();

  // Unknown, already spent, or past its TTL — all the same answer, and deliberately
  // one that says nothing about which, since this is an unauthenticated endpoint.
  if (!row?.github_id || Date.parse(row.expires_at) < Date.now()) {
    return Response.json({ error: "this deletion link has expired or was already used" }, { status: 400 });
  }

  try {
    await deleteAccount(env, row.github_id);
  } catch (e) {
    // Reported, never swallowed: a partial erasure that looks like a success is the
    // one outcome worse than a failed one. The token is still valid (it lives on the
    // pending_auth row the batch above would have removed), so the same link retries.
    track.error(e);
    return Response.json({ error: "deletion did not complete — the link is still valid, please try again" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
