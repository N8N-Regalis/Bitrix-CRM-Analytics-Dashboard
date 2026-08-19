// Google Identity Services sign-in gate.
//
// SCOPE: this is a client-side gate. It keeps unauthorized people out of the
// dashboard UI, but it is not a server-side authorization boundary -- the
// Supabase anon key still ships in the bundle and /api/bitrix is still
// callable without a session. Treat this as "who is using the app", not as
// protection for the underlying data.

import { decodeJwtPayload } from '@/utils/jwt';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const ALLOWED_DOMAIN = 'regaliscapital.com';

const STORAGE_KEY = 'crm-dashboard-auth';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Google ID tokens expire in ~1 hour, which would force an hourly re-login.
// Once a token validates we mint our own session envelope with a longer TTL.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const AUTH_ERRORS = {
  malformed: 'That sign-in response could not be read. Please try again.',
  audience: 'This sign-in was issued for a different application.',
  issuer: 'This sign-in did not come from Google.',
  expired: 'That sign-in has already expired. Please try again.',
  unverified: 'This Google account does not have a verified email address.',
  domain: `Use your @${ALLOWED_DOMAIN} account to sign in.`,
};

/**
 * Validate a Google credential (ID token) and build a session user.
 * Returns { ok: true, user } or { ok: false, reason } where reason is a key
 * of AUTH_ERRORS.
 */
export function verifyCredential(credential) {
  const claims = decodeJwtPayload(credential);
  if (!claims) return { ok: false, reason: 'malformed' };

  if (claims.aud !== GOOGLE_CLIENT_ID) return { ok: false, reason: 'audience' };
  if (!GOOGLE_ISSUERS.includes(claims.iss)) return { ok: false, reason: 'issuer' };

  const expiresAtMs = Number(claims.exp) * 1000;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  // email_verified arrives as a boolean or the string "true" depending on the flow.
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    return { ok: false, reason: 'unverified' };
  }

  const email = String(claims.email ?? '').toLowerCase().trim();
  // hd is the Workspace hosted-domain claim -- the real domain check. The
  // email suffix check is a second belt in case hd is ever absent.
  if (claims.hd !== ALLOWED_DOMAIN || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return { ok: false, reason: 'domain' };
  }

  return {
    ok: true,
    user: {
      email,
      name: claims.name || email,
      picture: claims.picture || null,
      expiresAt: Date.now() + SESSION_TTL_MS,
    },
  };
}

function isLiveSession(session) {
  return Boolean(
    session &&
      typeof session.email === 'string' &&
      session.email.endsWith(`@${ALLOWED_DOMAIN}`) &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now()
  );
}

/** Read the persisted session, or null when absent, malformed, or expired. */
export function loadSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!isLiveSession(session)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(user) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}
