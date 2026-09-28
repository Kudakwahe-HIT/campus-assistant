import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_SCORE, rankContent } from './match';

const items = [
  { id: 'apply', keywords: ['apply', 'application', 'how to apply', 'admission'] },
  { id: 'appfee', keywords: ['application fee', 'apply fee', 'how much to apply'] },
  { id: 'fees', keywords: ['fees', 'pay fees', 'fee structure', 'tuition', 'how to pay'] },
  { id: 'accom', keywords: ['accommodation', 'hostel', 'residence'] },
];

const top = (q: string) => rankContent(q, items)[0];

test('matches a plain question', () => {
  assert.equal(top('how do i apply')?.id, 'apply');
});

test('more specific item wins', () => {
  assert.equal(top('how much is the application fee')?.id, 'appfee');
});

test('handles casual spelling and mixed phrasing', () => {
  assert.equal(top('wen do i pay fees')?.id, 'fees');
});

test('tolerates one typo on longer words', () => {
  const r = top('is there acommodation');
  assert.equal(r?.id, 'accom');
  assert.ok(r.score >= MIN_SCORE);
});

test('unrelated text does not clear the threshold', () => {
  const r = top('what is the weather today');
  assert.ok(!r || r.score < MIN_SCORE);
});
