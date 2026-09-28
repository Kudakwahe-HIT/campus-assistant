import { asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { getDb } from '../../../../db';
import { contentItems, unansweredQuestions, users } from '../../../../db/schema';
import { requireStaff } from '../../../../dashboard/auth';
import { dismissQuestionAction, linkQuestionAction, reopenQuestionAction } from './actions';

export const dynamic = 'force-dynamic';

const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

export default async function Unanswered({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireStaff();
  const resolved = (await searchParams).view === 'resolved';
  const db = getDb();

  const [questions, items] = await Promise.all([
    db
      .select({
        id: unansweredQuestions.id,
        text: unansweredQuestions.text,
        createdAt: unansweredQuestions.createdAt,
        resolvedAt: unansweredQuestions.resolvedAt,
        role: users.role,
        contentId: contentItems.id,
        contentTitle: contentItems.title,
      })
      .from(unansweredQuestions)
      .innerJoin(users, eq(users.id, unansweredQuestions.userId))
      .leftJoin(contentItems, eq(contentItems.id, unansweredQuestions.resolvedContentId))
      .where(resolved ? isNotNull(unansweredQuestions.resolvedAt) : isNull(unansweredQuestions.resolvedAt))
      .orderBy(resolved ? desc(unansweredQuestions.resolvedAt) : desc(unansweredQuestions.createdAt))
      .limit(200),
    resolved
      ? Promise.resolve([])
      : db
          .select({ id: contentItems.id, title: contentItems.title, isPublished: contentItems.isPublished })
          .from(contentItems)
          .orderBy(asc(contentItems.title)),
  ]);

  return (
    <>
      <h1>Unanswered questions</h1>
      <p className="muted">
        Questions the bot could not match. Write an answer, link one that should have matched (then add the student&apos;s
        wording to its keywords), or dismiss off-topic messages.
      </p>

      <div className="tabs">
        <Link href="/dashboard/unanswered" className={resolved ? '' : 'active'}>
          Open
        </Link>
        <Link href="/dashboard/unanswered?view=resolved" className={resolved ? 'active' : ''}>
          Resolved
        </Link>
      </div>

      {questions.length === 0 ? (
        <p className="muted">{resolved ? 'Nothing resolved yet.' : 'Queue is empty. Nice.'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Question</th>
              <th>From</th>
              <th>{resolved ? 'Resolved' : 'Asked'}</th>
              <th>{resolved ? 'Answer' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td>{q.text}</td>
                <td>
                  <span className="badge">{q.role}</span>
                </td>
                <td className="small muted">{fmt(resolved ? q.resolvedAt! : q.createdAt)}</td>
                {resolved ? (
                  <td className="actions">
                    {q.contentId ? (
                      <Link href={`/dashboard/content/${q.contentId}`}>{q.contentTitle}</Link>
                    ) : (
                      <span className="muted">Dismissed</span>
                    )}{' '}
                    <form action={reopenQuestionAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <button type="submit" className="link small">
                        Reopen
                      </button>
                    </form>
                  </td>
                ) : (
                  <td>
                    <div className="row">
                      <Link href={`/dashboard/content/new?fromQuestion=${q.id}`} className="btn primary">
                        Write answer
                      </Link>
                      <form action={dismissQuestionAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <button type="submit">Dismiss</button>
                      </form>
                    </div>
                    <form action={linkQuestionAction} className="row" style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={q.id} />
                      <select name="contentId" className="inline" required defaultValue="">
                        <option value="" disabled>
                          Answered by…
                        </option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.title}
                            {i.isPublished ? '' : ' (draft)'}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="small">
                        Link
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
