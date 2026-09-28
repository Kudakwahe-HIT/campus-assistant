import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifySignature } from './verify';

const secret = 'test-secret';
const body = JSON.stringify({ hello: 'world' });
const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

test('accepts a valid signature', () => {
  assert.equal(verifySignature(body, sig, secret), true);
});

test('rejects a tampered body', () => {
  assert.equal(verifySignature(body + ' ', sig, secret), false);
});

test('rejects a wrong secret, missing header, bad prefix, and bad hex', () => {
  assert.equal(verifySignature(body, sig, 'other'), false);
  assert.equal(verifySignature(body, null, secret), false);
  assert.equal(verifySignature(body, sig.replace('sha256=', 'sha1='), secret), false);
  assert.equal(verifySignature(body, 'sha256=zzzz', secret), false);
});
