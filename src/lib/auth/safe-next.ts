/**
 * Sanitize a caller-supplied `next` redirect target.
 *
 * All three sign-in callbacks build their post-auth redirect by concatenating
 * `NEXT_PUBLIC_SITE_URL` + `next`. Without validation an attacker can pass
 * values that browsers resolve to a foreign origin:
 *   - `@evil.com`       → `https://our-pins.vercel.app@evil.com` (userinfo trick)
 *   - `.evil.com`       → `https://our-pins.vercel.app.evil.com` (lookalike host)
 *   - `//evil.com`      → protocol-relative URL → host evil.com
 *   - `/\evil.com`      → some browsers treat `\` as `/`
 *   - `https://evil.com`→ absolute URL
 *
 * A safe target is a same-origin relative path: exactly one leading slash,
 * not followed by another slash or a backslash. Anything else falls back to
 * the site root.
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== 'string') return '/';
  // Must start with a single "/" and not be a protocol-relative ("//") or
  // backslash ("/\") bypass.
  if (!/^\/(?![/\\])/.test(next)) return '/';
  return next;
}
