'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FriendsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [canResend, setCanResend] = useState(false);
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setDevLink(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, resend: canResend }),
      });
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setCanResend(res.status === 409);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setMessage(
          res.status === 409
            ? 'An invite is already pending. Resend it to get a fresh email link.'
            : (data?.error ?? 'That didn’t work — please try again.'),
        );
        return;
      }
      const data = (await res.json()) as { devLink?: string };
      setDevLink(data.devLink ?? null);
      setStatus('sent');
    } catch {
      setStatus('error');
      setMessage('Could not connect. Please try again.');
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invite a friend</h1>
        <Link href="/" className="text-sm text-blue-600 underline">
          Home
        </Link>
      </div>

      {status === 'sent' ? (
        <div className="flex flex-col gap-2">
          <p className="text-green-700">Invite sent! They’ll get an email.</p>
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
            Enter your friend’s email and we’ll send them an invite.
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setCanResend(false);
            }}
            placeholder="friend@example.com"
            className="rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {status === 'sending'
              ? 'Sending…'
              : canResend
                ? 'Resend invite'
                : 'Send invite'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-red-600">{message}</p>
          )}
        </form>
      )}
    </main>
  );
}
