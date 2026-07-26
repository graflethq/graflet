# 07 — CLI opt-in telemetry: one prompt, `DO_NOT_TRACK`, kill switch

**What to build:** The published CLI can report usage, but only if the user says yes, and it asks exactly once. On
the first **interactive** run it prints one short prompt — anonymous usage stats, yes/no, **default no** — and stores
the answer beside the existing credential store (`packages/cli/src/credential-store.ts`). A non-interactive run (CI,
a pipe, no TTY) never prompts and never sends: prompting in CI would hang a build, and defaulting to "yes" there
would be consent by absence. `GRAFLET_TELEMETRY=0` and `DO_NOT_TRACK=1` both hard-disable regardless of the stored
answer. This is the part of the design that cannot be walked back — once a version is on npm phoning home, it is on
npm forever — which is why the trade-off is recorded in ADR-0010 and why the default is no.

**Blocked by:** 01 (token), 02 (privacy page), 06 (backend already sends the authoritative download event).

**Status:** done 2026-07-26 — **built and tested, not yet published**. Publishing is the irreversible half
(see "Before publishing" below); nothing in this ticket reaches a user until `v0.4.0` is tagged.

- [x] First interactive run prints **one** prompt, no more than two lines, saying what is sent and that it is
      optional, with **no** as the default (bare Enter = no). `CONSENT_PROMPT` in `packages/cli/src/telemetry.ts`;
      verified on a real pty (`script -q /dev/null`) — bare Enter stored `{"enabled": false}`.
- [x] The answer persists next to the existing credential store and is never asked again — verified by running the
      CLI twice. `~/.config/graflet/telemetry.json` (0600), beside `credential-store.ts`'s plaintext fallback under
      the same XDG root. Second run on the pty did not re-ask; a later `n` did not overwrite a stored `y`.
- [x] With no TTY, the CLI **neither prompts nor sends**, and exits with the same status and output as before.
      Verified by piping the command in a script: `echo | graflet <slug>` and `graflet <slug> </dev/null` both
      printed the same line and exited 1, and wrote no consent file. Also verified **with a stored yes**: still
      silent, which is the literal reading of this box and the stricter one.
- [x] `GRAFLET_TELEMETRY=0` and `DO_NOT_TRACK=1` each independently disable all capture even when the stored answer
      is yes. `disabledByEnv()`, checked before the prompt so a kill switch does not get to ask either.
      `DO_NOT_TRACK=true` also counts (consoledonottrack.com); `DO_NOT_TRACK=0` does not.
- [x] A documented way to change the answer later exists (a flag or subcommand), and saying no afterwards stops all
      sending. `graflet telemetry [on|off]`, in `--help`, both READMEs and `/privacy`. `off` also stops the current
      process, not just the next run.
- [x] Events sent, and nothing else: `cli_command_run` (`command`, `cli_version`), `cli_login_completed`,
      `cli_download_completed` (`doc`, `version`, `duration_ms`, `bytes`), `cli_download_failed` (`reason`).
      `CliEvent` is a union, so a typo is a compile error rather than a permanently split series.
- [x] **No paths, no filenames, no argv, no hostnames, no env** are ever sent — only the fixed properties above. A
      grep of the capture call sites proves it — and so does a test: `download.test.ts` asserts the exact property
      key set of every event and that no payload contains the slug or `tmpdir()`. Two things this forced:
      `cli_command_run.command` is the SUBCOMMAND (`download`), never the slug off argv; and `download_failed`
      carries a fixed `reason` label, never the thrown message, which can quote a slug or an absolute path.
      **The IP was the gap in this list.** A server-side capture arrives over a plain HTTP request, so PostHog
      would store `$ip` and derive `$geoip_*` from it — the one identifier that travels whether or not you send it.
      Every payload now carries `$ip: null`. It is added in the transport, not in `capture()`, so `capture()` stays
      a pass-through and grepping its call sites is still a complete audit of the data.
- [x] Before login: a machine-local random id as `distinct_id`, `$identify`ed to the `github_id` at login, so the
      pre-login runs join the same person the site and backend see. **This needed TWO backend changes.** Poll
      returned `login` and `email` but not `github_id`, and the login can be renamed: migration
      `0007_pending_auth_github_id` + `handleCliPoll` now return it as a string, matching the site's
      `identify(String(github_id))`. And `login` alone is not enough — **bearer tokens never expire**, so everyone
      already holding a 0.3.0 token never runs `login` again and would have stayed on the machine id forever, which
      silently defeats the site→CLI funnel for the entire existing install base. The broker now returns
      `X-Graflet-User` on the KG response (it already had the id in hand for `kg_download_brokered`), and the
      download path identifies from it. Guarded so it fires once, not once per download.
- [x] Telemetry failure is invisible: no network wait that delays a command, no error printed if PostHog is
      unreachable, no non-zero exit. Proved with a test that forces capture to reject (and asserts nothing reached
      `process.stderr`). **This box is met in spirit, not to the letter, and that is deliberate.** `process.exit`
      kills pending sockets, so with no wait at all nothing would ever be delivered and the feature would be
      theatre. A capped `flush()` runs on both exit paths, after all output. Two things keep the trade honest: an
      opted-out machine — the default — has nothing in flight and so waits exactly zero, and each request carries
      its own 1s `AbortSignal`, so a firewall that blackholes rather than refuses cannot stretch the cap.
- [x] The CLI README and the privacy page both document the telemetry, the default, and both kill switches — before
      the version that contains it is published. `packages/cli/README.md`, `packages/graflet-pypi/README.md` and the
      new `#cli` section on `/privacy`. The old bullet claiming "the CLI sends no usage data" is gone.
- [x] Version bump follows the repo's release rule: the same version in `packages/cli/package.json`,
      `packages/graflet-pypi/pyproject.toml` and `packages/graflet-pypi/src/graflet/__init__.py`. **0.4.0.**

## Two decisions the checkboxes did not ask for

**No `posthog-node` dependency.** The CLI has exactly one dependency (`@napi-rs/keyring`) and this is a `fetch` POST
to `/i/v0/e/` — a dozen lines. Adding an SDK to a globally-installed CLI to send four events would cost every user
install time for nothing.

**`logout` forgets the telemetry identity, which the ticket did not mention.** Without it, a shared machine files the
next person's runs under the account that just signed out. Dropping the `github_id` alone is not enough: the
`anonymous_id` was merged into the departing person at sign-in, so PostHog still resolves it to them. `forgetPerson()`
mints a fresh one — the same two-step, for the same reason, as the site's `forgetPerson` in `apps/web/lib/analytics.ts`.

## What the review changed

`/code-review-mp` (Standards + Spec) ran against the finished branch. Four findings were real and are fixed above:
the install-base identity gap (`X-Graflet-User`), the undisclosed IP (`$ip: null`), an `EACCES` on a read-only
`$HOME` that could throw out of `startTelemetry` despite its "never throws" contract, and a `GRAFLET_POSTHOG_KEY`
override that nothing needed — deleted. Two style findings landed too: `askLine`'s doc comment cited ADR-0006 for
what is now also an ADR-0010 prompt (the ADR is explicit that conflating the two bases is a compliance error), and
the three deliberate ceilings in `telemetry.ts` — module state, no retry, the flush cap — now carry `ponytail:`
comments naming the upgrade path. The duplicated test bootstrap became `src/telemetry.fixture.ts`, which also
gave `auth_expired` a pinned test: `failureReason` maps error *prose* to labels, so without one, rewording a
message in `api.ts` would silently degrade the label to `"error"` with nothing failing.

## Before publishing (operator)

- **Deploy the backend** — migration 0007 and the poll change. Until then the CLI signs in fine but stays
  anonymous (covered by a test), so the site→CLI funnel is thin rather than broken.
- **Tag `v0.4.0`** — `.github/workflows/publish.yml` publishes npm + PyPI via OIDC. This is the irreversible step.
