import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { getDb } from '../../../../db';
import { contentItems } from '../../../../db/schema';
import { requireStaff } from '../../../../dashboard/auth';
import { reviewDue } from '../../../../dashboard/content';

export const dynamic = 'force-dynamic';

const FILTERS = { all: 'All', published: 'Published', drafts: 'Drafts', due: 'Review due' } as const;
type Filter = keyof typeof FILTERS;

export default async function ContentList({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireStaff();
  const { filter: raw } = await searchParams;
  const filter: Filter = raw && raw in FILTERS ? (raw as Filter) : 'all';

  const all = await getDb()
    .select()
    .from(contentItems)
    .orderBy(asc(contentItems.category), asc(contentItems.title));

  const now = new Date();
  const items = all.filter((i) => {
    if (filter === 'published') return i.isPublished;
    if (filter === 'drafts') return !i.isPublished;
    if (filter === 'due') return i.isPublished && reviewDue(i.lastReviewedAt, now);
    return true;
  });

  return (
    <>
      <div className="spread">
        <h1>Content</h1>
        <Link href="/dashboard/content/new" className="btn primary">
          New answer
        </Link>
      </div>

      <div className="tabs">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link key={f} href={`/dashboard/content?filter=${f}`} className={f === filter ? 'active' : ''}>
            {FILTERS[f]}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Owner</th>
              <th>Last reviewed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <Link href={`/dashboard/content/${i.id}`}>{i.title}</Link>
                </td>
                <td>{i.category.replace('_', ' ')}</td>
                <td>{i.ownerName ?? <span className="badge bad">No owner</span>}</td>
                <td>
                  {i.lastReviewedAt ? i.lastReviewedAt.toISOString().slice(0, 10) : <span className="muted">Never</span>}{' '}
                  {i.isPublished && reviewDue(i.lastReviewedAt, now) && <span className="badge warn">Due</span>}
                </td>
                <td>{i.isPublished ? <span className="badge ok">Published</span> : <span className="badge">Draft</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
