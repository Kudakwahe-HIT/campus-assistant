import { createHmac, timingSafeEqual } from 'node:crypto';

// Stateless signed session token: "<staffId>.<expiresAtMs>.<hmac>".
// Staff are re-loaded from the DB on every request, so disabling an account takes effect immediately.

export const SESSION_COOKIE = 'hit_staff_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
// "Remember me" on the login form asks for this instead.
export const SESSION_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(staffId: string, secret: string, now = Date.now(), ttlMs = SESSION_TTL_MS): string {
  const payload = `${staffId}.${now + ttlMs}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the staff id if the token is authentic and unexpired. */
export function readSessionToken(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [staffId, expires, mac] = parts;
  const expected = Buffer.from(sign(`${staffId}.${expires}`, secret));
  const actual = Buffer.from(mac);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (!(Number(expires) > now)) return null;
  return staffId;
}
