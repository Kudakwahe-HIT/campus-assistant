'use server';

import { redirect } from 'next/navigation';
import { logIn, logOut } from '../../../dashboard/auth';

export async function loginAction(form: FormData) {
  const ok = await logIn(String(form.get('email') ?? ''), String(form.get('password') ?? ''), form.get('remember') === 'on');
  redirect(ok ? '/dashboard' : '/login?error=1');
}

export async function logoutAction() {
  await logOut();
  redirect('/login');
}
