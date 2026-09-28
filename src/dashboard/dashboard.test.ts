import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import type { Db } from '../db';
import { contentItems, handoffTickets, messages, staffUsers, unansweredQuestions, users } from '../db/schema';
import { createTestDb } from '../test/pglite';
import { parseContentForm, parseKeywords, reviewDue, saveContent } from './content';
import { closeTicket, InboxError, maskPhone, reopenTicket, replyToTicket, type Sender } from './inbox';
import { hashPassword, verifyPassword } from './password';
import { createSessionToken, readSessionToken, SESSION_TTL_MS, SESSION_TTL_REMEMBER_MS } from './session';

let db: Db;
let client: PGlite;

before(async () => {
  ({ db, client } = await createTestDb());
});
after(async () => {
  await client.close();
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('auth', () => {
  const SECRET = 'x'.repeat(40);

  test('passwords round-trip and reject wrong ones', async () => {
    const h = await hashPassword('correct horse battery');
    assert.ok(await verifyPassword('correct horse battery', h));
    assert.ok(!(await verifyPassword('wrong', h)));
    assert.ok(!(await verifyPassword('anything', 'garbage')));
  });

  test('session tokens verify, expire, and resist tampering', () => {
    const now = 1_000_000;
    const token = createSessionToken('staff-1', SECRET, now);
    assert.equal(readSessionToken(token, SECRET, now + 1000), 'staff-1');
    assert.equal(readSessionToken(token, SECRET, now + SESSION_TTL_MS + 1), null);
    assert.equal(readSessionToken(token, 'y'.repeat(40), now), null);
    assert.equal(readSessionToken(token.replace('staff-1', 'staff-2'), SECRET, now), null);
    assert.equal(readSessionToken(undefined, SECRET), null);
  });

  test('"remember me" uses the longer TTL', () => {
    const now = 1_000_000;
    const token = createSessionToken('staff-1', SECRET, now, SESSION_TTL_REMEMBER_MS);
    assert.equal(readSessionToken(token, SECRET, now + SESSION_TTL_MS + 1), 'staff-1');
    assert.equal(readSessionToken(token, SECRET, now + SESSION_TTL_REMEMBER_MS + 1), null);
  });
});

describe('content editor', () => {
  const base = { category: 'fees', title: 'Fee deadlines', body: 'See the notice.', keywords: 'Fees, fee deadline,, fees' };

  test('keywords are trimmed, lowercased and de-duplicated', () => {
    assert.deepEqual(parseKeywords(' Fees, fee   deadline,,fees\nTuition '), ['fees', 'fee deadline', 'tuition']);
  });

  test('publishing requires an owner and a review date', () => {
    const noOwner = parseContentForm(form({ ...base, isPublished: 'on', intent: 'review' }));
    assert.deepEqual(noOwner, { ok: false, error: 'Published answers need an owner.' });

    const noDate = parseContentForm(form({ ...base, isPublished: 'on', ownerName: 'Finance', intent: 'save' }));
    assert.deepEqual(noDate, { ok: false, error: 'Published answers need a review date.' });

    const draft = parseContentForm(form({ ...base, intent: 'save' }));
    assert.ok(draft.ok);
  });

  test('"mark reviewed" stamps today; future review dates are rejected', () => {
    const now = new Date('2026-09-28T10:00:00Z');
    const r = parseContentForm(form({ ...base, ownerName: 'Finance', isPublished: 'on', intent: 'review' }), now);
    assert.ok(r.ok && r.value.lastReviewedAt?.getTime() === now.getTime());

    const future = parseContentForm(form({ ...base, lastReviewedAt: '2027-01-01', intent: 'save' }), now);
    assert.equal(future.ok, false);
  });

  test('rejects unknown categories', () => {
    assert.equal(parseContentForm(form({ ...base, category: 'nope' })).ok, false);
  });

  test('review is due after 180 days or when never reviewed', () => {
    const now = new Date('2026-09-28T00:00:00Z');
    assert.ok(reviewDue(null, now));
    assert.ok(reviewDue(new Date('2026-03-01T00:00:00Z'), now));
    assert.ok(!reviewDue(new Date('2026-08-01T00:00:00Z'), now));
  });

  test('saving an answer from the queue resolves the question', async () => {
    const [u] = await db.insert(users).values({ phone: '263770000001', role: 'student' }).returning();
    const [q] = await db.insert(unansweredQuestions).values({ userId: u.id, text: 'is there wifi' }).returning();
    const parsed = parseContentForm(
      form({ category: 'campus_life', title: 'Wifi', body: 'Yes: HIT-Student.', keywords: 'wifi', ownerName: 'ICT', isPublished: 'on', intent: 'review' }),
    );
    assert.ok(parsed.ok);
    const id = await saveContent(db, null, parsed.value, q.id);

    const [after] = await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.id, q.id));
    assert.ok(after.resolvedAt);
    assert.equal(after.resolvedContentId, id);
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    assert.equal(item.ownerName, 'ICT');
    assert.ok(item.isPublished);
  });
});

describe('shared inbox', () => {
  let staff: { id: string; email: string };
  let userId: string;
  let ticketId: string;
  const sent: { to: string; body: string }[] = [];
  const fakeSend: Sender = async (to, body) => {
    sent.push({ to, body });
    return `wamid.out.${sent.length}`;
  };

  before(async () => {
    const [s] = await db
      .insert(staffUsers)
      .values({ email: 'tendai@hit.ac.zw', name: 'Tendai', passwordHash: 'x' })
      .returning();
    staff = { id: s.id, email: s.email };
    const [u] = await db.insert(users).values({ phone: '263771112222', name: 'Rudo', role: 'student' }).returning();
    userId = u.id;
    await db.insert(messages).values({ userId, direction: 'in', kind: 'text', body: 'talk to a person', waMessageId: 'wamid.in.1' });
    const [t] = await db.insert(handoffTickets).values({ userId }).returning();
    ticketId = t.id;
  });

  test('reply goes through the sender, is logged with the staff id, and assigns the ticket', async () => {
    await replyToTicket(db, ticketId, staff, '  Hi Rudo, how can I help?  ', fakeSend);

    assert.deepEqual(sent, [{ to: '263771112222', body: 'Hi Rudo, how can I help?' }]);
    const out = await db
      .select()
      .from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.direction, 'out')));
    assert.equal(out.length, 1);
    assert.equal(out[0].body, 'Hi Rudo, how can I help?');
    assert.equal(out[0].sentByStaffId, staff.id);
    assert.equal(out[0].waMessageId, 'wamid.out.1');

    const [t] = await db.select().from(handoffTickets).where(eq(handoffTickets.id, ticketId));
    assert.equal(t.status, 'assigned');
    assert.equal(t.assignedTo, 'tendai@hit.ac.zw');
  });

  test('a failed send is not logged as delivered', async () => {
    const failing: Sender = async () => {
      throw new Error('WhatsApp API 400');
    };
    await assert.rejects(replyToTicket(db, ticketId, staff, 'hello?', failing), InboxError);
    const out = await db.select().from(messages).where(and(eq(messages.userId, userId), eq(messages.body, 'hello?')));
    assert.equal(out.length, 0);
  });

  test('refuses empty replies and replies outside the 24h window', async () => {
    await assert.rejects(replyToTicket(db, ticketId, staff, '   ', fakeSend), /Type a message/);
    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    await assert.rejects(replyToTicket(db, ticketId, staff, 'late', fakeSend, tomorrow), /24 hours/);
  });

  test('closed tickets cannot be replied to until reopened', async () => {
    await closeTicket(db, ticketId);
    await assert.rejects(replyToTicket(db, ticketId, staff, 'still there?', fakeSend), /closed/);
    await reopenTicket(db, ticketId);
    const [t] = await db.select().from(handoffTickets).where(eq(handoffTickets.id, ticketId));
    assert.equal(t.status, 'assigned');
    assert.equal(t.closedAt, null);
  });

  test('cannot reopen when the student already has another live ticket', async () => {
    await closeTicket(db, ticketId);
    await db.insert(handoffTickets).values({ userId });
    await assert.rejects(reopenTicket(db, ticketId), /another live ticket/);
  });

  test('phones are masked for display', () => {
    assert.equal(maskPhone('263771112222'), '+263 77 *** 2222');
  });
});
