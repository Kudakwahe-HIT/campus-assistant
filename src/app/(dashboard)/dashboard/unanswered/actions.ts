'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../db';
import { requireStaff } from '../../../../dashboard/auth';
import { reopenQuestion, resolveQuestion } from '../../../../dashboard/content';

const done = () => revalidatePath('/dashboard', 'layout');

/** "Already answered by X": links the question to an existing item. */
export async function linkQuestionAction(form: FormData) {
  await requireStaff();
  const contentId = String(form.get('contentId') ?? '');
  if (!contentId) return;
  await resolveQuestion(getDb(), String(form.get('id')), contentId);
  done();
}

export async function dismissQuestionAction(form: FormData) {
  await requireStaff();
  await resolveQuestion(getDb(), String(form.get('id')), null);
  done();
}

export async function reopenQuestionAction(form: FormData) {
  await requireStaff();
  await reopenQuestion(getDb(), String(form.get('id')));
  done();
}
