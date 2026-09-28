import { and, count, eq, isNull, lt, or } from 'drizzle-orm';
import Link from 'next/link';
import { getDb } from '../../../db';
import { contentItems, handoffTickets, unansweredQuestions } from '../../../db/schema';
import { requireStaff } from '../../../dashboard/auth';
import { REVIEW_INTERVAL_DAYS } from '../../../dashboard/content';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  await requireStaff();
  const db = getDb();
  const staleBefore = new Date(Date.now() - REVIEW_INTERVAL_DAYS * 86_400_000);

  const [[open], [assigned], [questions], [due]] = await Promise.all([
    db.select({ n: count() }).from(handoffTickets).where(eq(handoffTickets.status, 'open')),
    db.select({ n: count() }).from(handoffTickets).where(eq(handoffTickets.status, 'assigned')),
    db.select({ n: count() }).from(unansweredQuestions).where(isNull(unansweredQuestions.resolvedAt)),
    db
      .select({ n: count() })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.isPublished, true),
          or(isNull(contentItems.lastReviewedAt), lt(contentItems.lastReviewedAt, staleBefore)),
        ),
      ),
  ]);

  const stats = [
    { n: open.n, l: 'Unassigned handoffs', href: '/dashboard/inbox?status=open' },
    { n: assigned.n, l: 'Assigned handoffs', href: '/dashboard/inbox?status=assigned' },
    { n: questions.n, l: 'Unanswered questions', href: '/dashboard/unanswered' },
    { n: due.n, l: `Answers due for review (>${REVIEW_INTERVAL_DAYS} days)`, href: '/dashboard/content?filter=due' },
  ];

  return (
    <>
      <h1>Overview</h1>
      <div className="stats">
        {stats.map((s) => (
          <Link key={s.l} href={s.href} className="panel stat">
            <div className="n">{s.n}</div>
            <div className="l">{s.l}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
