import { count, inArray, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { getDb } from '../../../db';
import { handoffTickets, unansweredQuestions } from '../../../db/schema';
import { requireStaff } from '../../../dashboard/auth';
import { logoutAction } from '../login/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Pages and actions also call requireStaff(); layouts are not re-run on every navigation.
  const staff = await requireStaff();
  const db = getDb();
  const [[tickets], [questions]] = await Promise.all([
    db.select({ n: count() }).from(handoffTickets).where(inArray(handoffTickets.status, ['open', 'assigned'])),
    db.select({ n: count() }).from(unansweredQuestions).where(isNull(unansweredQuestions.resolvedAt)),
  ]);

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">HIT Campus Assistant</div>
        <Link href="/dashboard">Overview</Link>
        <Link href="/dashboard/inbox">
          Inbox {tickets.n > 0 && <span className="count">{tickets.n}</span>}
        </Link>
        <Link href="/dashboard/unanswered">
          Unanswered {questions.n > 0 && <span className="count">{questions.n}</span>}
        </Link>
        <Link href="/dashboard/content">Content</Link>
        <div className="me">
          {staff.name}
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
