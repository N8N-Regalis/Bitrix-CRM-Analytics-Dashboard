// Minimal JWT payload decoder. We only ever decode Google ID tokens, whose
// signature is verified by Google before the credential reaches us -- this is
// a read of the claims, NOT a verification. See services/googleAuth.js for the
// claim checks that actually gate access.

function base64UrlToBytes(segment) {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode the payload of a JWT. Returns null when the token is malformed.
 * Uses TextDecoder rather than bare atob so non-ASCII names survive intact.
 */
export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;

  try {
    const json = new TextDecoder('utf-8').decode(base64UrlToBytes(segments[1]));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
