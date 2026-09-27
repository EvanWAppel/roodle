'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GameShell } from '@/components/GameShell';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setDevLink(null);
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const data = (await res.json()) as { devLink?: string };
      setDevLink(data.devLink ?? null);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  return (
    <GameShell
      title="Your seat at the table."
      eyebrow="Welcome to Roodle"
      current="/signin"
    >
      <p className="page-description">
        Sign in with your email. We’ll send you a link, and you’re in. No
        password to remember.
      </p>
      {status === 'sent' ? (
        <div className="form-panel success-panel" role="status">
          <p className="success-title">Check your email for a sign-in link.</p>
          <p className="field-hint">
            Sent to {email}. Open the link on this device to pick up your games.
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setStatus('idle');
              setDevLink(null);
            }}
          >
            Use another email or try again
          </button>
          <Link href="/" className="text-link">
            Back to Roodle
          </Link>
          {devLink && (
            <p className="field-hint">
              Development preview link:{' '}
              <a href={devLink} className="text-link break-all">
                {devLink}
              </a>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="form-panel">
          <label className="field-label" htmlFor="email">
            Enter your email and we&apos;ll send a magic link.
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="text-field"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="button"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && (
            <p className="notice notice-error" role="alert">
              That didn&apos;t work — check the email and try again.
            </p>
          )}
        </form>
      )}
    </GameShell>
  );
}
