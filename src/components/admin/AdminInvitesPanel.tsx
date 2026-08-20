'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Invite } from '@/lib/supabase/types';
import { publicEnv } from '@/lib/env';

type Status = 'revoked' | 'expired' | 'full' | 'active';

function statusOf(i: Invite): Status {
  if (i.revoked_at) return 'revoked';
  if (new Date(i.expires_at).getTime() < Date.now()) return 'expired';
  if (i.use_count >= i.max_uses) return 'full';
  return 'active';
}

const STATUS_LABEL: Record<Status, string> = {
  revoked: 'Revoked',
  expired: 'Expired',
  full: 'Fully used',
  active: 'Active',
};

// Default expiry for the date picker: 14 days out, matching the DB default.
function defaultExpiryDate() {
  const d = new Date(Date.now() + 14 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function AdminInvitesPanel({ invites }: { invites: Invite[] }) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [expiryDate, setExpiryDate] = useState(defaultExpiryDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // The date input gives a bare yyyy-mm-dd; expire at the end of that day in
    // the admin's own timezone, which is what "expires on the 30th" means.
    const expiresAt = expiryDate
      ? new Date(`${expiryDate}T23:59:59`).toISOString()
      : undefined;
    const res = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: note || undefined, count, maxUses, expiresAt }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not create invite');
      setBusy(false);
      return;
    }
    setNote('');
    setCount(1);
    setMaxUses(1);
    setExpiryDate(defaultExpiryDate());
    router.refresh();
    setBusy(false);
  }

  async function revoke(token: string) {
    setRevoking(token);
    await fetch(`/api/admin/invites/${token}`, { method: 'DELETE' });
    router.refresh();
    setRevoking(null);
  }

  function copyLink(token: string) {
    const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}/invite/${token}`;
    void navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col text-sm">
            <span className="mb-1 text-[var(--muted)]">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. LINE group announcement"
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-[var(--muted)]">Links</span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-[var(--muted)]">People per link</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-28 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-[var(--muted)]">Expires</span>
            <input
              type="date"
              value={expiryDate}
              min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? tCommon('loading') : t('createInvite')}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {maxUses > 1
            ? `One link that admits ${maxUses} people — anyone who has the link can join until the seats run out or it expires. Post it where only the community can see it.`
            : 'A single-use link: the first person to open it joins, and the link is then spent.'}
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--muted)]">
            <th className="py-2">Token</th>
            <th>Note</th>
            <th>Used</th>
            <th>Status</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invites.map((i) => {
            const status = statusOf(i);
            return (
              <tr key={i.token} className="border-t border-[var(--border)]">
                <td className="py-2 font-mono text-xs">{i.token.slice(0, 8)}…</td>
                <td>{i.note ?? '—'}</td>
                <td>
                  {i.use_count}
                  {i.max_uses > 1 ? ` / ${i.max_uses}` : ''}
                </td>
                <td className={status === 'active' ? '' : 'text-[var(--muted)]'}>
                  {STATUS_LABEL[status]}
                </td>
                <td className="text-xs text-[var(--muted)]">
                  {new Date(i.expires_at).toLocaleDateString()}
                </td>
                <td className="flex gap-2 py-2">
                  {status === 'active' ? (
                    <>
                      <button
                        onClick={() => copyLink(i.token)}
                        className="rounded border border-[var(--border)] px-2 py-1"
                      >
                        {copied === i.token ? tCommon('copied') : t('copyLink')}
                      </button>
                      <button
                        onClick={() => revoke(i.token)}
                        disabled={revoking === i.token}
                        aria-busy={revoking === i.token}
                        className="rounded border border-[var(--border)] px-2 py-1 disabled:cursor-wait disabled:opacity-60"
                      >
                        {revoking === i.token ? tCommon('loading') : t('revoke')}
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
