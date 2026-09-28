import { getDb } from '../db';
import { messages, users, type User } from '../db/schema';
import type { InboundMessage } from '../whatsapp/parse';
import { replyPreview, sendReply, sendText } from '../whatsapp/send';
import { handleMessage } from './router';

async function upsertUser(m: InboundMessage): Promise<User> {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ phone: m.from, name: m.profileName ?? null })
    .onConflictDoUpdate({ target: users.phone, set: { lastSeenAt: new Date() } })
    .returning();
  return user;
}

/** Full pipeline for one inbound message: dedupe, log, route, send, log replies. */
export async function processInbound(m: InboundMessage): Promise<void> {
  const db = getDb();
  const user = await upsertUser(m);

  // Meta redelivers webhooks; the unique wa_message_id makes this idempotent.
  const inserted = await db
    .insert(messages)
    .values({ waMessageId: m.waMessageId, userId: user.id, direction: 'in', kind: m.kind, body: m.text ?? null })
    .onConflictDoNothing({ target: messages.waMessageId })
    .returning({ id: messages.id });
  if (inserted.length === 0) return;

  try {
    const replies = await handleMessage(db, user, m);
    for (const reply of replies) {
      const waId = await sendReply(m.from, reply);
      await db.insert(messages).values({
        waMessageId: waId ?? null,
        userId: user.id,
        direction: 'out',
        kind: reply.kind,
        body: replyPreview(reply),
      });
    }
  } catch (err) {
    console.error('processInbound failed', { waMessageId: m.waMessageId, err });
    try {
      await sendText(m.from, 'Sorry, something went wrong on our side. Please try again in a moment.');
    } catch {
      /* nothing more we can do */
    }
  }
}
