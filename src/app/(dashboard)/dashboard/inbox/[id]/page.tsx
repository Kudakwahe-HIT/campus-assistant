import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../../../db';
import { handoffTickets, messages, staffUsers, users } from '../../../../../db/schema';
import { requireStaff } from '../../../../../dashboard/auth';
import { lastInboundAt, maskPhone, windowOpen } from '../../../../../dashboard/inbox';
import { assignToMeAction, closeTicketAction } from '../actions';
import { ReopenForm, ReplyForm } from '../forms';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

export default async function Ticket({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = getDb();

  const [row] = await db
    .select({ ticket: handoffTickets, user: users })
    .from(handoffTickets)
    .innerJoin(users, eq(users.id, handoffTickets.userId))
    .where(eq(handoffTickets.id, id))
    .limit(1);
  if (!row) notFound();
  const { ticket, user } = row;

  const [history, lastIn] = await Promise.all([
    db
      .select({
        id: messages.id,
        direction: messages.direction,
        kind: messages.kind,
        body: messages.body,
        createdAt: messages.createdAt,
        staffName: staffUsers.name,
      })
      .from(messages)
      .leftJoin(staffUsers, eq(staffUsers.id, messages.sentByStaffId))
      .where(eq(messages.userId, user.id))
      .orderBy(desc(messages.createdAt))
      .limit(200),
    lastInboundAt(db, user.id),
  ]);
  history.reverse();

  const disabledReason =
    ticket.status === 'closed'
      ? 'This ticket is closed and the bot is handling the chat again. Reopen it to reply.'
      : !windowOpen(lastIn)
        ? 'The student last wrote more than 24 hours ago. WhatsApp only delivers free-form replies inside that window; they need to message again first.'
        : null;

  return (
    <>
      <div className="spread">
        <div>
          <h1>{user.name ?? 'Unknown name'}</h1>
          <div className="muted small">
            {maskPhone(user.phone)} · {user.role}
            {user.verifiedAt ? ' (verified)' : ''} · ticket opened {fmt(ticket.createdAt)}
          </div>
        </div>
        <div className="row">
          {ticket.status === 'open' && <span className="badge bad">Unassigned</span>}
          {ticket.status === 'assigned' && <span className="badge info">Assigned to {ticket.assignedTo}</span>}
          {ticket.status === 'closed' && <span className="badge">Closed</span>}

          {ticket.status !== 'closed' && ticket.assignedTo !== staff.email && (
            <form action={assignToMeAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <button type="submit">Assign to me</button>
            </form>
          )}
          {ticket.status !== 'closed' ? (
            <form action={closeTicketAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <button type="submit">Close &amp; return to bot</button>
            </form>
          ) : (
            <ReopenForm ticketId={ticket.id} />
          )}
          <Link href="/dashboard/inbox">Back</Link>
        </div>
      </div>

      <div className="thread">
        {history.length === 0 && <span className="muted">No messages yet.</span>}
        {history.map((m) => (
          <div key={m.id} className={`bubble ${m.direction}${m.staffName ? ' staff' : ''}`}>
            {m.body ?? <em className="muted">[{m.kind === 'unsupported' ? 'attachment: open WhatsApp Manager to view' : m.kind}]</em>}
            <span className="meta">
              {m.direction === 'out' ? (m.staffName ?? 'Bot') : 'Student'} · {fmt(m.createdAt)}
            </span>
          </div>
        ))}
      </div>

      <ReplyForm ticketId={ticket.id} disabledReason={disabledReason} />
    </>
  );
}
