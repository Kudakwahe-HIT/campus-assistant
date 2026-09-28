import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractInbound } from './parse';

const wrap = (messages: unknown[]) => ({
  entry: [{ changes: [{ value: { contacts: [{ wa_id: '263771234567', profile: { name: 'Tino' } }], messages } }] }],
});

test('parses a text message with the profile name', () => {
  const [m] = extractInbound(
    wrap([{ id: 'wamid.1', from: '263771234567', timestamp: '1700000000', type: 'text', text: { body: 'Hi' } }]),
  );
  assert.equal(m.kind, 'text');
  assert.equal(m.text, 'Hi');
  assert.equal(m.profileName, 'Tino');
});

test('parses list and button replies into replyId', () => {
  const list = extractInbound(
    wrap([{ id: 'w2', from: '1', timestamp: '1', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'cat:fees', title: 'Fees' } } }]),
  );
  const btn = extractInbound(
    wrap([{ id: 'w3', from: '1', timestamp: '1', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'human', title: 'Talk' } } }]),
  );
  assert.equal(list[0].replyId, 'cat:fees');
  assert.equal(btn[0].replyId, 'human');
});

test('marks images as unsupported and ignores status-only payloads', () => {
  const [img] = extractInbound(wrap([{ id: 'w4', from: '1', timestamp: '1', type: 'image' }]));
  assert.equal(img.kind, 'unsupported');
  assert.deepEqual(extractInbound({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] }), []);
  assert.deepEqual(extractInbound({}), []);
});
