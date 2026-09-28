import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../../../db';
import { contentItems, unansweredQuestions } from '../../../../../db/schema';
import { requireStaff } from '../../../../../dashboard/auth';
import { CATEGORIES } from '../../../../../dashboard/content';
import { deleteContentAction } from '../actions';
import { ContentForm, type ContentFormValues } from '../content-form';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; fromQuestion?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { saved, fromQuestion } = await searchParams;
  const db = getDb();

  let values: ContentFormValues;
  let question: string | null = null;

  if (id === 'new') {
    values = {
      id: null,
      category: 'general',
      title: '',
      keywords: '',
      body: '',
      ownerName: '',
      lastReviewedAt: '',
      isPublished: false,
      fromQuestion: null,
    };
    if (fromQuestion && UUID.test(fromQuestion)) {
      const [q] = await db.select().from(unansweredQuestions).where(eq(unansweredQuestions.id, fromQuestion)).limit(1);
      if (q) {
        question = q.text;
        values.fromQuestion = q.id;
        values.title = q.text.length <= 80 ? q.text : '';
      }
    }
  } else {
    if (!UUID.test(id)) notFound();
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
    if (!item) notFound();
    values = {
      id: item.id,
      category: item.category,
      title: item.title,
      keywords: item.keywords.join(', '),
      body: item.body,
      ownerName: item.ownerName ?? '',
      lastReviewedAt: item.lastReviewedAt?.toISOString().slice(0, 10) ?? '',
      isPublished: item.isPublished,
      fromQuestion: null,
    };
  }

  return (
    <>
      <div className="spread">
        <h1>{values.id ? 'Edit answer' : 'New answer'}</h1>
        <Link href="/dashboard/content">Back to content</Link>
      </div>

      {saved && <div className="alert success">Saved.</div>}
      {question && (
        <div className="alert warn">
          Answering a student question: <strong>“{question}”</strong>. Saving resolves it in the queue.
        </div>
      )}

      <ContentForm key={JSON.stringify(values)} values={values} categories={CATEGORIES} />

      {values.id && (
        <form action={deleteContentAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={values.id} />
          <button type="submit" className="danger">
            Delete this answer
          </button>{' '}
          <span className="muted small">Prefer unpublishing if you might need it again.</span>
        </form>
      )}
    </>
  );
}
