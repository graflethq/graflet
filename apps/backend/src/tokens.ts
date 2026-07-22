/** Bearer-token helpers. The raw token is handed to the CLI once; only its
 *  SHA-256 hash is ever stored (tickets 03 mint, 05/08 verify). */

/** A high-entropy opaque bearer: 32 random bytes, base64url, no padding. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256 of a token, lowercase hex. Store/look up tokens by this, never raw. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
