'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GameShell } from '@/components/GameShell';
import { useRouter } from 'next/navigation';

interface PendingInviteView {
  id: string;
  inviteeEmail: string;
  expired: boolean;
  label: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [canResend, setCanResend] = useState(false);
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingInviteView[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendError, setResendError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const res = await fetch('/api/invites');
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { invites?: PendingInviteView[] };
      setPending(data.invites ?? []);
    } catch {
      // A failed refresh leaves the last-known list in place; the send/resend
      // actions surface their own errors, so we don't overwrite the UI here.
    }
  }, [router]);

  useEffect(() => {
    // Defer the load into a microtask so setState runs outside the effect body
    // (avoids the synchronous-setState-in-effect lint). refreshPending is stable
    // (memoized on the stable Next.js router), so this runs once on mount.
    Promise.resolve().then(refreshPending);
  }, [refreshPending]);

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
      void refreshPending();
    } catch {
      setStatus('error');
      setMessage('Could not connect. Please try again.');
    }
  }

  async function resend(invite: PendingInviteView) {
    setResendingId(invite.id);
    setResendError(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: invite.inviteeEmail, resend: true }),
      });
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setResendError({
          id: invite.id,
          message:
            data?.error ??
            'The invite couldn’t be resent. Please try again.',
        });
        return;
      }
      await refreshPending();
    } catch {
      setResendError({
        id: invite.id,
        message: 'Could not connect. Please try again.',
      });
    } finally {
      setResendingId(null);
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

      {pending.length > 0 && (
        <section aria-labelledby="pending-heading">
          <div className="section-heading">
            <h2 id="pending-heading">Pending invitations</h2>
            <span>{pending.length} awaiting a reply</span>
          </div>
          <ul className="pending-list">
            {pending.map((invite) => (
              <li className="pending-card" key={invite.id}>
                <div>
                  <strong>{invite.inviteeEmail}</strong>
                  <small>{invite.label}</small>
                  {resendError?.id === invite.id && (
                    <p className="notice notice-error" role="alert">
                      {resendError.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="button button-outline button-small"
                  style={{ marginLeft: 'auto' }}
                  disabled={resendingId === invite.id}
                  onClick={() => resend(invite)}
                >
                  {resendingId === invite.id ? 'Resending…' : 'Resend'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </GameShell>
  );
}
