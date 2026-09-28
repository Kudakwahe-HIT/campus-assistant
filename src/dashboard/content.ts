import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { contentCategory, contentItems, unansweredQuestions } from '../db/schema';

export const CATEGORIES = contentCategory.enumValues;
export type Category = (typeof CATEGORIES)[number];

/** Published answers older than this are flagged for review. */
export const REVIEW_INTERVAL_DAYS = 180;

export function reviewDue(lastReviewedAt: Date | null, now = new Date()): boolean {
  if (!lastReviewedAt) return true;
  return now.getTime() - lastReviewedAt.getTime() > REVIEW_INTERVAL_DAYS * 86_400_000;
}

export type ContentInput = {
  category: Category;
  title: string;
  keywords: string[];
  body: string;
  ownerName: string | null;
  lastReviewedAt: Date | null;
  isPublished: boolean;
};

export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  for (const k of raw.split(/[,\n]/)) {
    const v = k.trim().toLowerCase().replace(/\s+/g, ' ');
    if (v) seen.add(v);
  }
  return [...seen];
}

/**
 * Validates the editor form. The "Save & mark reviewed" button (intent=review) stamps
 * today's date, which is how an owner confirms the facts are still correct.
 */
export function parseContentForm(
  form: FormData,
  now = new Date(),
): { ok: true; value: ContentInput } | { ok: false; error: string } {
  const str = (k: string) => String(form.get(k) ?? '').trim();

  const category = str('category') as Category;
  if (!CATEGORIES.includes(category)) return { ok: false, error: 'Choose a category.' };

  const title = str('title');
  if (!title) return { ok: false, error: 'Title is required.' };
  if (title.length > 200) return { ok: false, error: 'Title is too long (200 characters max).' };

  const body = str('body');
  if (!body) return { ok: false, error: 'Answer text is required.' };
  if (body.length > 4000) {
    return { ok: false, error: 'Answer is too long for one WhatsApp message (4000 characters max).' };
  }

  let lastReviewedAt: Date | null = null;
  if (form.get('intent') === 'review') {
    lastReviewedAt = now;
  } else if (str('lastReviewedAt')) {
    lastReviewedAt = new Date(`${str('lastReviewedAt')}T00:00:00Z`);
    if (Number.isNaN(lastReviewedAt.getTime())) return { ok: false, error: 'Review date is not a valid date.' };
    if (lastReviewedAt.getTime() > now.getTime()) return { ok: false, error: 'Review date cannot be in the future.' };
  }

  const ownerName = str('ownerName') || null;
  const isPublished = form.get('isPublished') === 'on';
  if (isPublished && !ownerName) return { ok: false, error: 'Published answers need an owner.' };
  if (isPublished && !lastReviewedAt) return { ok: false, error: 'Published answers need a review date.' };

  return {
    ok: true,
    value: { category, title, keywords: parseKeywords(str('keywords')), body, ownerName, lastReviewedAt, isPublished },
  };
}

/** Creates or updates an item. If it answers a queued question, that question is resolved. */
export async function saveContent(
  db: Db,
  id: string | null,
  value: ContentInput,
  resolvesQuestionId?: string | null,
): Promise<string> {
  let savedId: string;
  if (id) {
    await db.update(contentItems).set({ ...value, updatedAt: new Date() }).where(eq(contentItems.id, id));
    savedId = id;
  } else {
    const [row] = await db.insert(contentItems).values(value).returning({ id: contentItems.id });
    savedId = row.id;
  }
  if (resolvesQuestionId) await resolveQuestion(db, resolvesQuestionId, savedId);
  return savedId;
}

/** contentId null = dismissed (spam, off-topic, duplicate). */
export async function resolveQuestion(db: Db, questionId: string, contentId: string | null): Promise<void> {
  await db
    .update(unansweredQuestions)
    .set({ resolvedAt: new Date(), resolvedContentId: contentId })
    .where(eq(unansweredQuestions.id, questionId));
}

export async function reopenQuestion(db: Db, questionId: string): Promise<void> {
  await db
    .update(unansweredQuestions)
    .set({ resolvedAt: null, resolvedContentId: null })
    .where(eq(unansweredQuestions.id, questionId));
}
