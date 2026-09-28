import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import Link from 'next/link';
import { getDb } from '../../../../db';
import { handoffTickets, messages, users } from '../../../../db/schema';
import { requireStaff } from '../../../../dashboard/auth';
import { maskPhone } from '../../../../dashboard/inbox';

export const dynamic = 'force-dynamic';

const VIEWS = { live: 'Active', open: 'Unassigned', mine: 'Mine', closed: 'Closed' } as const;
type View = keyof typeof VIEWS;

const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

export default async function Inbox({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await requireStaff();
  const raw = (await searchParams).status;
  const view: View = raw && raw in VIEWS ? (raw as View) : 'live';
  const db = getDb();

  const where: Record<View, SQL | undefined> = {
    live: inArray(handoffTickets.status, ['open', 'assigned']),
    open: eq(handoffTickets.status, 'open'),
    mine: and(eq(handoffTickets.status, 'assigned'), eq(handoffTickets.assignedTo, staff.email)),
    closed: eq(handoffTickets.status, 'closed'),
  };

  const tickets = await db
    .select({ ticket: handoffTickets, name: users.name, phone: users.phone, role: users.role })
    .from(handoffTickets)
    .innerJoin(users, eq(users.id, handoffTickets.userId))
    .where(where[view])
    .orderBy(view === 'closed' ? desc(handoffTickets.closedAt) : desc(handoffTickets.createdAt))
    .limit(100);

  const userIds = [...new Set(tickets.map((t) => t.ticket.userId))];
  const latest = userIds.length
    ? await db
        .selectDistinctOn([messages.userId], {
          userId: messages.userId,
          body: messages.body,
          direction: messages.direction,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.userId, userIds))
        .orderBy(messages.userId, desc(messages.createdAt))
    : [];
  const lastByUser = new Map(latest.map((m) => [m.userId, m]));

  return (
    <>
      <h1>Inbox</h1>
      <div className="tabs">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={`/dashboard/inbox?status=${v}`} className={v === view ? 'active' : ''}>
            {VIEWS[v]}
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <p className="muted">No tickets here.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Last message</th>
              <th>Status</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(({ ticket, name, phone, role }) => {
              const last = lastByUser.get(ticket.userId);
              const waiting = last?.direction === 'in' && ticket.status !== 'closed';
              return (
                <tr key={ticket.id}>
                  <td>
                    <Link href={`/dashboard/inbox/${ticket.id}`}>{name ?? 'Unknown name'}</Link>
                    <div className="small muted">
                      {maskPhone(phone)} · {role}
                    </div>
                  </td>
                  <td className="small" style={{ maxWidth: 380 }}>
                    {last ? (
                      <>
                        {waiting && <span className="badge warn">Waiting</span>}{' '}
                        <span className="muted">{last.direction === 'out' ? 'Sent: ' : ''}</span>
                        {(last.body ?? '[attachment]').slice(0, 120)}
                        <div className="muted">{fmt(last.createdAt)}</div>
                      </>
                    ) : (
                      <span className="muted">No messages</span>
                    )}
                  </td>
                  <td>
                    {ticket.status === 'open' && <span className="badge bad">Unassigned</span>}
                    {ticket.status === 'assigned' && <span className="badge info">{ticket.assignedTo}</span>}
                    {ticket.status === 'closed' && <span className="badge">Closed</span>}
                  </td>
                  <td className="small muted">{fmt(ticket.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
