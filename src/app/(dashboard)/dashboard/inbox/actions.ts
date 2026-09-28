'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../db';
import { requireStaff } from '../../../../dashboard/auth';
import { assignTicket, closeTicket, InboxError, reopenTicket, replyToTicket } from '../../../../dashboard/inbox';

export type ReplyState = { error?: string; draft?: string; sentAt?: number };

const refresh = () => revalidatePath('/dashboard', 'layout');

export async function replyAction(_prev: ReplyState, form: FormData): Promise<ReplyState> {
  const staff = await requireStaff();
  const body = String(form.get('body') ?? '');
  try {
    await replyToTicket(getDb(), String(form.get('ticketId')), staff, body);
  } catch (err) {
    if (err instanceof InboxError) return { error: err.message, draft: body };
    throw err;
  }
  refresh();
  return { sentAt: Date.now() };
}

export async function assignToMeAction(form: FormData) {
  const staff = await requireStaff();
  await assignTicket(getDb(), String(form.get('ticketId')), staff);
  refresh();
}

export async function closeTicketAction(form: FormData) {
  await requireStaff();
  await closeTicket(getDb(), String(form.get('ticketId')));
  refresh();
}

export async function reopenTicketAction(_prev: ReplyState, form: FormData): Promise<ReplyState> {
  await requireStaff();
  try {
    await reopenTicket(getDb(), String(form.get('ticketId')));
  } catch (err) {
    if (err instanceof InboxError) return { error: err.message };
    throw err;
  }
  refresh();
  return {};
}
