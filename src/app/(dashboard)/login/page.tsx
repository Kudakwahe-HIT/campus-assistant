import { redirect } from 'next/navigation';
import { getStaff } from '../../../dashboard/auth';
import { loginAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaff()) redirect('/dashboard');
  const { error } = await searchParams;

  return (
    <main className="login">
      <h1>HIT Campus Assistant</h1>
      <form action={loginAction} className="panel">
        {error && <div className="alert error">Wrong email or password.</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="primary" type="submit" style={{ width: '100%' }}>
          Sign in
        </button>
      </form>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Staff accounts are created by an administrator.
      </p>
    </main>
  );
}
