import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { handoffTickets, messages, users } from '../db/schema';
import { sendText } from '../whatsapp/send';

/** WhatsApp only allows free-form replies within 24h of the user's last message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type Sender = (to: string, body: string) => Promise<string | undefined>;
export type StaffRef = { id: string; email: string };

/** Errors safe to show to staff as-is. */
export class InboxError extends Error {}

export async function lastInboundAt(db: Db, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.direction, 'in')))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.at ?? null;
}

export function windowOpen(lastIn: Date | null, now = new Date()): boolean {
  return !!lastIn && now.getTime() - lastIn.getTime() < SERVICE_WINDOW_MS;
}

/**
 * Sends a staff reply through WhatsApp and logs it as an outbound message.
 * The first reply on an open ticket assigns it to the sender.
 */
export async function replyToTicket(
  db: Db,
  ticketId: string,
  staff: StaffRef,
  rawBody: string,
  send: Sender = sendText,
  now = new Date(),
): Promise<void> {
  const body = rawBody.trim();
  if (!body) throw new InboxError('Type a message first.');
  if (body.length > 4096) throw new InboxError('Message is too long (4096 characters max).');

  const [row] = await db
    .select({ ticket: handoffTickets, phone: users.phone })
    .from(handoffTickets)
    .innerJoin(users, eq(users.id, handoffTickets.userId))
    .where(eq(handoffTickets.id, ticketId))
    .limit(1);
  if (!row) throw new InboxError('Ticket not found.');
  if (row.ticket.status === 'closed') throw new InboxError('This ticket is closed. Reopen it to reply.');
  if (!windowOpen(await lastInboundAt(db, row.ticket.userId), now)) {
    throw new InboxError(
      'It has been more than 24 hours since the student last wrote, so WhatsApp will not deliver a free-form reply.',
    );
  }

  let waId: string | undefined;
  try {
    waId = await send(row.phone, body);
  } catch (err) {
    console.error('staff reply failed', { ticketId, err });
    throw new InboxError('WhatsApp did not accept the message, so nothing was sent. Please try again.');
  }

  await db.insert(messages).values({
    waMessageId: waId ?? null,
    userId: row.ticket.userId,
    direction: 'out',
    kind: 'text',
    body,
    sentByStaffId: staff.id,
    createdAt: now,
  });

  if (row.ticket.status === 'open') {
    await db
      .update(handoffTickets)
      .set({ status: 'assigned', assignedTo: staff.email })
      .where(eq(handoffTickets.id, ticketId));
  }
}

export async function assignTicket(db: Db, ticketId: string, staff: StaffRef): Promise<void> {
  await db
    .update(handoffTickets)
    .set({ status: 'assigned', assignedTo: staff.email })
    .where(and(eq(handoffTickets.id, ticketId), inArray(handoffTickets.status, ['open', 'assigned'])));
}

/** Closing hands the chat back to the bot. */
export async function closeTicket(db: Db, ticketId: string): Promise<void> {
  await db
    .update(handoffTickets)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(handoffTickets.id, ticketId));
}

export async function reopenTicket(db: Db, ticketId: string): Promise<void> {
  const [t] = await db.select().from(handoffTickets).where(eq(handoffTickets.id, ticketId)).limit(1);
  if (!t) throw new InboxError('Ticket not found.');
  // The router assumes at most one live ticket per user.
  const [live] = await db
    .select({ id: handoffTickets.id })
    .from(handoffTickets)
    .where(and(eq(handoffTickets.userId, t.userId), inArray(handoffTickets.status, ['open', 'assigned'])))
    .limit(1);
  if (live && live.id !== ticketId) throw new InboxError('This student already has another live ticket.');
  await db
    .update(handoffTickets)
    .set({ status: t.assignedTo ? 'assigned' : 'open', closedAt: null })
    .where(eq(handoffTickets.id, ticketId));
}

/** "263771234567" -> "+263 77 *** 4567": enough to recognise, not enough to copy out. */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return '***';
  return `+${phone.slice(0, 3)} ${phone.slice(3, 5)} *** ${phone.slice(-4)}`;
}
