/**
 * SHA-256, from the platform. No dependency: verification is this site's
 * whole security posture and is not a place to carry a hand-rolled digest.
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
