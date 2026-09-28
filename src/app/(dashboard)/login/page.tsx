import { redirect } from 'next/navigation';
import { getStaff } from '../../../dashboard/auth';
import { loginAction } from './actions';
import './login.css';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaff()) redirect('/dashboard');
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <div className="auth-illustration">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG asset, no optimization needed */}
        <img src="/login-illustration.svg" alt="" width={500} height={500} />
        <div className="auth-dots" aria-hidden="true">
          <span />
          <span />
          <span className="active" />
        </div>
      </div>

      <div className="auth-divider" />

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <h1>Welcome back!</h1>

          {error && <div className="auth-alert">Wrong email or password.</div>}

          <form action={loginAction}>
            <div className="auth-field">
              <label htmlFor="email">Email Address</label>
              <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>

            <div className="auth-row">
              <label className="auth-check">
                <span className="auth-check-box">
                  <input type="checkbox" name="remember" />
                  <svg className="auth-check-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5l3.2 3.2L13 4.5" />
                  </svg>
                </span>
                Remember me
              </label>
              <span>Contact Administrator.</span>
            </div>

            <button className="auth-submit" type="submit">
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
