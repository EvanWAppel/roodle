'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <Link href="/" className="text-sm text-blue-600 underline">
          Home
        </Link>
      </div>

      {status === 'sent' ? (
        <div className="flex flex-col gap-2">
          <p className="text-green-700">
            Check your email for a sign-in link.
          </p>
          {devLink && (
            <p className="text-xs text-gray-500">
              Dev link (no email provider wired yet):{' '}
              <a href={devLink} className="break-all text-blue-600 underline">
                {devLink}
              </a>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm text-gray-600" htmlFor="email">
            Enter your email and we&apos;ll send a magic link.
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-red-600">
              That didn&apos;t work — check the email and try again.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
