import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header against the RAW request body.
 * Must be called with the exact bytes Meta sent (read with req.text(), not re-serialised JSON).
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody).digest('hex'), 'hex');
  const given = Buffer.from(header.slice('sha256='.length), 'hex');
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
