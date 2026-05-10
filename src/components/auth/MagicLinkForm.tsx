'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Props {
  siteUrl: string;
  next: string;
}

export function MagicLinkForm({ siteUrl, next }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${siteUrl}/api/auth/magic/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <p>
          Check your email. We sent a sign-in link to <strong>{email}</strong>.
        </p>
        <p className="mt-2 text-[var(--muted)]">
          The link expires in an hour. If you don&apos;t see it, check spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-[var(--fg)]"
      />
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {error ? <p className="text-sm text-[var(--color-terracotta-500)]">{error}</p> : null}
    </form>
  );
}
