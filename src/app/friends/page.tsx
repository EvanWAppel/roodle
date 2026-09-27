'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GameShell } from '@/components/GameShell';
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
    <GameShell
      title="Good company starts here."
      eyebrow="Invite a friend"
      current="/friends"
    >
      <p className="page-description">
        A drawing, a guess, an inside joke. Make a little room for someone you
        like.
      </p>
      {status === 'sent' ? (
        <div className="form-panel success-panel" role="status">
          <p className="success-title">Invite sent! They’ll get an email.</p>
          <p className="field-hint">
            Sent to {email}. They’ll sign in with that address to join your
            game.
          </p>
          <Link className="button" href="/">
            Back to your games
          </Link>
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setEmail('');
              setStatus('idle');
              setCanResend(false);
              setDevLink(null);
            }}
          >
            Invite another friend
          </button>
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
            {status === 'sending'
              ? 'Sending…'
              : canResend
                ? 'Resend invite'
                : 'Send invite'}
          </button>
          {status === 'error' && (
            <p className="notice notice-error" role="alert">
              {message}
            </p>
          )}
        </form>
      )}
    </GameShell>
  );
}
