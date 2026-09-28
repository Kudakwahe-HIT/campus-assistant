'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '../../../../db';
import { contentItems } from '../../../../db/schema';
import { requireStaff } from '../../../../dashboard/auth';
import { parseContentForm, saveContent } from '../../../../dashboard/content';

// On error the submitted values come back so the (auto-reset) form keeps what the editor typed.
export type FormState = { error?: string; values?: Record<string, string | boolean> };

export async function saveContentAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = parseContentForm(form);
  if (!parsed.ok) {
    const str = (k: string) => String(form.get(k) ?? '');
    return {
      error: parsed.error,
      values: {
        category: str('category'),
        title: str('title'),
        keywords: str('keywords'),
        body: str('body'),
        ownerName: str('ownerName'),
        lastReviewedAt: str('lastReviewedAt'),
        isPublished: form.get('isPublished') === 'on',
      },
    };
  }

  const id = String(form.get('id') ?? '') || null;
  const fromQuestion = String(form.get('fromQuestion') ?? '') || null;
  const savedId = await saveContent(getDb(), id, parsed.value, fromQuestion);

  revalidatePath('/dashboard', 'layout');
  redirect(`/dashboard/content/${savedId}?saved=1`);
}

export async function deleteContentAction(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  // Unanswered questions linked to this item fall back to "resolved, no content" via ON DELETE SET NULL.
  await getDb().delete(contentItems).where(eq(contentItems.id, id));
  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard/content');
}
