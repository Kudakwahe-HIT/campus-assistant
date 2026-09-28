import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import {
  contentItems,
  departments,
  handoffTickets,
  schools,
  unansweredQuestions,
  users,
  type User,
} from '../db/schema';
import type { InboundMessage } from '../whatsapp/parse';
import { MIN_SCORE, normalize, rankContent } from './match';
import { afterAnswer, CATEGORY_LABELS, mainMenu, roleChoice } from './menus';
import type { Reply } from './types';

const GREETINGS = new Set(['hi', 'hello', 'hey', 'menu', 'start', 'help', '0', 'main menu']);
const HUMAN_WORDS = new Set(['agent', 'human', 'person', 'staff', 'operator', 'talk to a person', 'talk to someone']);

const text = (body: string): Reply => ({ kind: 'text', body });

/**
 * Decides what to send back for one inbound message.
 * Returns replies; the caller sends and logs them. Rules first, no AI yet.
 */
export async function handleMessage(db: Db, user: User, m: InboundMessage): Promise<Reply[]> {
  if (m.kind === 'unsupported') {
    return [text('I can only read text messages for now. Send *menu* to see what I can help with.')];
  }

  const input = normalize(m.text ?? '');

  // Broadcast opt-out / opt-in (applies to alerts in Phase 2)
  if (input === 'stop') {
    await db.update(users).set({ optedOutAt: new Date() }).where(eq(users.id, user.id));
    return [text('You will no longer receive broadcast alerts. Send *subscribe* to turn them back on, or *menu* for help.')];
  }
  if (input === 'subscribe') {
    await db.update(users).set({ optedOutAt: null }).where(eq(users.id, user.id));
    return [text('Alerts are back on. Send *menu* for help.')];
  }

  // First contact: find out who they are
  if (user.role === 'unknown') {
    if (m.replyId?.startsWith('role:')) {
      const role = m.replyId.slice('role:'.length);
      if (role === 'prospect' || role === 'student' || role === 'staff') {
        await db.update(users).set({ role }).where(eq(users.id, user.id));
        const note =
          role === 'prospect'
            ? []
            : [text('Thanks. Personal features like timetables and alerts need verification, which is coming soon. For now I can answer public questions.')];
        return [...note, mainMenu()];
      }
    }
    return [roleChoice()];
  }

  const isNavigation = Boolean(m.replyId) || GREETINGS.has(input) || HUMAN_WORDS.has(input);

  // If a human has taken the chat, stay quiet on free text so we don't talk over them.
  if (!isNavigation && (await hasOpenTicket(db, user.id))) return [];

  if (m.replyId === 'menu:main' || GREETINGS.has(input)) return [mainMenu()];
  if (m.replyId === 'human' || HUMAN_WORDS.has(input)) return startHandoff(db, user);

  if (m.replyId?.startsWith('cat:')) return categoryReply(db, m.replyId.slice(4));
  if (m.replyId?.startsWith('item:')) return itemReply(db, m.replyId.slice(5));
  if (m.replyId?.startsWith('school:')) return schoolReply(db, Number(m.replyId.slice(7)));

  return freeTextReply(db, user, m.text ?? '');
}

/* ---------- Handlers ---------- */

async function categoryReply(db: Db, category: string): Promise<Reply[]> {
  if (category === 'programmes') {
    const rows = await db.select().from(schools).orderBy(asc(schools.name));
    if (rows.length === 0) return noContent();
    return [
      {
        kind: 'list',
        body: 'HIT has these schools. Pick one to see its departments.',
        button: 'Choose school',
        sections: [{ rows: rows.slice(0, 10).map((s) => ({ id: `school:${s.id}`, title: s.name })) }],
      },
    ];
  }

  if (!(category in CATEGORY_LABELS)) return [mainMenu()];

  const items = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.category, category as never), eq(contentItems.isPublished, true)))
    .orderBy(asc(contentItems.title));

  if (items.length === 0) return noContent();
  if (items.length === 1) return [text(formatItem(items[0].title, items[0].body)), afterAnswer()];

  return [
    {
      kind: 'list',
      body: `*${CATEGORY_LABELS[category].title}*\nWhat would you like to know?`,
      button: 'Choose topic',
      sections: [{ rows: items.slice(0, 10).map((i) => ({ id: `item:${i.id}`, title: i.title })) }],
    },
  ];
}

async function itemReply(db: Db, id: string): Promise<Reply[]> {
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.isPublished, true)))
    .limit(1);
  if (!item) return noContent();
  return [text(formatItem(item.title, item.body)), afterAnswer()];
}

async function schoolReply(db: Db, schoolId: number): Promise<Reply[]> {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!school) return [mainMenu()];
  const depts = await db
    .select()
    .from(departments)
    .where(eq(departments.schoolId, schoolId))
    .orderBy(asc(departments.name));
  const lines = depts.map((d) => `• ${d.name}`).join('\n');
  return [text(`*${school.name}*\n\n${lines}`), afterAnswer()];
}

async function freeTextReply(db: Db, user: User, raw: string): Promise<Reply[]> {
  const items = await db
    .select({ id: contentItems.id, title: contentItems.title, body: contentItems.body, keywords: contentItems.keywords })
    .from(contentItems)
    .where(eq(contentItems.isPublished, true));

  const best = rankContent(raw, items)[0];
  if (best && best.score >= MIN_SCORE) {
    const item = items.find((i) => i.id === best.id)!;
    return [text(formatItem(item.title, item.body)), afterAnswer()];
  }

  // No answer: log it so staff can add content, then offer a way forward.
  await db.insert(unansweredQuestions).values({ userId: user.id, text: raw.slice(0, 1000) });
  return [
    text("Sorry, I don't have an answer to that yet. I've noted your question so we can add it."),
    {
      kind: 'buttons',
      body: 'What would you like to do?',
      buttons: [
        { id: 'menu:main', title: 'Main menu' },
        { id: 'human', title: 'Talk to a person' },
      ],
    },
  ];
}

async function startHandoff(db: Db, user: User): Promise<Reply[]> {
  if (!(await hasOpenTicket(db, user.id))) {
    await db.insert(handoffTickets).values({ userId: user.id });
  }
  return [text("I've passed you to our team. A staff member will reply here. Send *menu* any time to go back to the bot.")];
}

/* ---------- Helpers ---------- */

async function hasOpenTicket(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: handoffTickets.id })
    .from(handoffTickets)
    .where(and(eq(handoffTickets.userId, userId), inArray(handoffTickets.status, ['open', 'assigned'])))
    .orderBy(desc(handoffTickets.createdAt))
    .limit(1);
  return rows.length > 0;
}

function noContent(): Reply[] {
  return [
    text("I don't have information on that loaded yet."),
    {
      kind: 'buttons',
      body: 'Would you like to speak to someone?',
      buttons: [
        { id: 'human', title: 'Talk to a person' },
        { id: 'menu:main', title: 'Main menu' },
      ],
    },
  ];
}

function formatItem(title: string, body: string): string {
  return `*${title}*\n\n${body}`;
}
