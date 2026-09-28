import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { PGlite } from '@electric-sql/pglite';
import type { Db } from '../db';
import { handoffTickets, unansweredQuestions, users } from '../db/schema';
import { seedDatabase } from '../db/seed-data';
import { createTestDb } from '../test/pglite';
import type { InboundMessage } from '../whatsapp/parse';
import { handleMessage } from './router';
import type { Reply } from './types';

const PHONE = '263771234567';

let db: Db;
let client: PGlite;
let seq = 0;

before(async () => {
  ({ db, client } = await createTestDb());
  const log = console.log;
  console.log = () => {};
  try {
    await seedDatabase(db);
  } finally {
    console.log = log;
  }
});

after(async () => {
  await client.close();
});

/** Mirrors processInbound: upsert the user, then route with a fresh copy of them. */
async function send(input: { text?: string; replyId?: string; kind?: InboundMessage['kind'] }): Promise<Reply[]> {
  const [user] = await db
    .insert(users)
    .values({ phone: PHONE, name: 'Test Student' })
    .onConflictDoUpdate({ target: users.phone, set: { lastSeenAt: new Date() } })
    .returning();
  const m: InboundMessage = {
    waMessageId: `wamid.test.${++seq}`,
    from: PHONE,
    profileName: 'Test Student',
    timestamp: Math.floor(Date.now() / 1000),
    kind: input.kind ?? (input.replyId ? 'reply' : 'text'),
    text: input.text,
    replyId: input.replyId,
  };
  return handleMessage(db, user, m);
}

async function currentUser() {
  const [u] = await db.select().from(users).where(eq(users.phone, PHONE));
  return u;
}

const ids = (r: Reply | undefined) =>
  !r ? [] : r.kind === 'buttons' ? r.buttons.map((b) => b.id) : r.kind === 'list' ? r.sections.flatMap((s) => s.rows.map((x) => x.id)) : [];

describe('router end-to-end (PGlite)', () => {
  test('first contact asks who they are, whatever they type', async () => {
    const replies = await send({ text: 'how do i apply' });
    assert.equal(replies.length, 1);
    assert.deepEqual(ids(replies[0]), ['role:prospect', 'role:student', 'role:staff']);
    assert.equal((await currentUser()).role, 'unknown');
  });

  test('choosing a role saves it and shows the main menu', async () => {
    const replies = await send({ replyId: 'role:prospect', text: 'New / prospective' });
    assert.equal((await currentUser()).role, 'prospect');
    assert.equal(replies.length, 1);
    assert.ok(ids(replies[0]).includes('cat:admissions'));
  });

  test('"how do i apply" answers from published content', async () => {
    const replies = await send({ text: 'how do i apply' });
    assert.equal(replies[0].kind, 'text');
    assert.match(replies[0].body, /\*How to apply\*/);
    assert.match(replies[0].body, /apply\.hit\.ac\.zw/);
    assert.deepEqual(ids(replies[1]), ['menu:main', 'human']);
  });

  test('menu categories list published items only', async () => {
    const [list] = await send({ replyId: 'cat:admissions', text: 'Admissions' });
    assert.equal(list.kind, 'list');
    assert.equal(ids(list).length, 4);

    // Registration only has a DRAFT item, so it must not leak.
    const [reg] = await send({ replyId: 'cat:registration', text: 'Registration' });
    assert.doesNotMatch(reg.body, /DRAFT|TODO/);
  });

  test('draft content is never used for free-text answers', async () => {
    const replies = await send({ text: 'course registration' });
    assert.doesNotMatch(replies.map((r) => r.body).join('\n'), /DRAFT|TODO/);
  });

  test('an unanswered question is logged and offers a person', async () => {
    const before = (await db.select().from(unansweredQuestions)).length;
    const replies = await send({ text: 'is there a swimming pool on campus' });
    assert.match(replies[0].body, /don't have an answer/);
    assert.deepEqual(ids(replies[1]), ['menu:main', 'human']);

    const rows = await db.select().from(unansweredQuestions);
    assert.equal(rows.length, before + 1);
    assert.equal(rows.at(-1)!.text, 'is there a swimming pool on campus');
    assert.equal(rows.at(-1)!.userId, (await currentUser()).id);
  });

  test('tapping a stale button does not log its label as a question', async () => {
    const before = (await db.select().from(unansweredQuestions)).length;
    const replies = await send({ replyId: 'role:student', text: 'Current student' });
    assert.ok(ids(replies[0]).includes('cat:admissions'));
    assert.equal((await db.select().from(unansweredQuestions)).length, before);
  });

  test('malformed reply ids fall back to the menu instead of erroring', async () => {
    for (const replyId of ['item:not-a-uuid', 'school:abc', 'cat:constructor', 'cat:toString']) {
      const replies = await send({ replyId, text: 'x' });
      assert.ok(replies.length > 0, replyId);
    }
  });

  describe('handoff', () => {
    const openTickets = async () =>
      (await db.select().from(handoffTickets).where(eq(handoffTickets.userId, (await currentUser()).id))).filter(
        (t) => t.status !== 'closed',
      );

    test('asking for a person opens exactly one ticket', async () => {
      const replies = await send({ replyId: 'human', text: 'Talk to a person' });
      assert.match(replies[0].body, /passed you to our team/);
      await send({ text: 'talk to a person' });
      assert.equal((await openTickets()).length, 1);
    });

    test('bot stays quiet on free text while a human has the chat', async () => {
      assert.deepEqual(await send({ text: 'how do i apply' }), []);
      assert.deepEqual(await send({ text: 'is there a swimming pool on campus' }), []);
    });

    test('greetings go to the human, not the bot', async () => {
      assert.deepEqual(await send({ text: 'hi' }), []);
      assert.deepEqual(await send({ text: 'hello' }), []);
    });

    test('images go to the human without a bot reply', async () => {
      assert.deepEqual(await send({ kind: 'unsupported' }), []);
    });

    test('"menu" hands the chat back to the bot, as promised', async () => {
      const [menu] = await send({ text: 'menu' });
      assert.ok(ids(menu).includes('cat:admissions'));
      assert.equal((await openTickets()).length, 0);

      const replies = await send({ text: 'how do i apply' });
      assert.match(replies[0].body, /How to apply/);
    });
  });

  test('STOP and SUBSCRIBE toggle broadcast opt-out', async () => {
    await send({ text: 'STOP' });
    assert.ok((await currentUser()).optedOutAt);
    await send({ text: 'subscribe' });
    assert.equal((await currentUser()).optedOutAt, null);
  });
});
