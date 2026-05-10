'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Invite } from '@/lib/supabase/types';
import { publicEnv } from '@/lib/env';

export function AdminInvitesPanel({ invites }: { invites: Invite[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: note || undefined, count }),
    });
    setNote('');
    setCount(1);
    router.refresh();
    setBusy(false);
  }

  async function revoke(token: string) {
    await fetch(`/api/admin/invites/${token}`, { method: 'DELETE' });
    router.refresh();
  }

  function copyLink(token: string) {
    const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}/invite/${token}`;
    void navigator.clipboard.writeText(url);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-1 flex-col text-sm">
          <span className="mb-1 text-[var(--muted)]">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-[var(--muted)]">Count</span>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          {t('createInvite')}
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--muted)]">
            <th className="py-2">Token</th>
            <th>Note</th>
            <th>Used</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invites.map((i) => {
            const expiresAt = new Date(i.expires_at);
            const isRevoked = !i.used_at && expiresAt.getTime() < Date.now();
            return (
              <tr key={i.token} className="border-t border-[var(--border)]">
                <td className="py-2 font-mono text-xs">{i.token.slice(0, 8)}…</td>
                <td>{i.note ?? '—'}</td>
                <td>
                  {i.used_at
                    ? 'Used'
                    : isRevoked
                      ? <span className="text-[var(--muted)]">Revoked</span>
                      : '–'}
                </td>
                <td className="text-xs text-[var(--muted)]">
                  {isRevoked ? '—' : expiresAt.toLocaleDateString()}
                </td>
                <td className="flex gap-2 py-2">
                  {!i.used_at && !isRevoked ? (
                    <>
                      <button onClick={() => copyLink(i.token)} className="rounded border border-[var(--border)] px-2 py-1">
                        {t('copyLink')}
                      </button>
                      <button onClick={() => revoke(i.token)} className="rounded border border-[var(--border)] px-2 py-1">
                        {t('revoke')}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
