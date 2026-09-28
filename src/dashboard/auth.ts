import { and, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '../db';
import { staffUsers, type StaffUser } from '../db/schema';
import { env } from '../env';
import { verifyPassword } from './password';
import { createSessionToken, readSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from './session';

export type Staff = Pick<StaffUser, 'id' | 'email' | 'name'>;

export const getStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = readSessionToken(token, env.sessionSecret);
  if (!id) return null;
  const [staff] = await getDb()
    .select({ id: staffUsers.id, email: staffUsers.email, name: staffUsers.name })
    .from(staffUsers)
    .where(and(eq(staffUsers.id, id), isNull(staffUsers.disabledAt)))
    .limit(1);
  return staff ?? null;
});

/** Call at the top of every dashboard page and server action. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect('/login');
  return staff;
}

export async function logIn(email: string, password: string): Promise<boolean> {
  const [staff] = await getDb()
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.email, email.trim().toLowerCase()))
    .limit(1);
  // Hash anyway on unknown emails so response time doesn't reveal which accounts exist.
  const ok = await verifyPassword(password, staff?.passwordHash ?? DUMMY_HASH);
  if (!staff || !ok || staff.disabledAt) return false;

  (await cookies()).set(SESSION_COOKIE, createSessionToken(staff.id, env.sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function logOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);
