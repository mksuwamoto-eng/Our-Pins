'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Row {
  id: string;
  display_name: string;
  is_member: boolean;
  role: string;
  created_at: string;
  archived_at: string | null;
  real_name: string | null;
}

type BusyKey = `${string}:${'member' | 'role'}`;

export function AdminMembersTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<BusyKey | null>(null);

  async function update(
    id: string,
    field: 'member' | 'role',
    patch: Partial<Pick<Row, 'is_member' | 'role'>>,
  ) {
    setBusy(`${id}:${field}`);
    try {
      // Must go through the service-role route: 0012 revoked the browser
      // client's grant to update is_member/role, so a direct update no-ops.
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) alert(`Could not update member: ${await res.text()}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[var(--muted)]">
          <th className="py-2">Display</th>
          <th>Real name</th>
          <th>Member</th>
          <th>Role</th>
          <th>Joined</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-[var(--border)]">
            <td className="py-2">{r.display_name}</td>
            <td className="text-[var(--muted)]">{r.real_name ?? '—'}</td>
            <td>{r.is_member ? '✓' : '–'}</td>
            <td>{r.role}</td>
            <td className="text-xs text-[var(--muted)]">{new Date(r.created_at).toLocaleDateString()}</td>
            <td className="flex gap-2 py-2">
              <button
                disabled={busy?.startsWith(`${r.id}:`)}
                aria-busy={busy === `${r.id}:member`}
                onClick={() => update(r.id, 'member', { is_member: !r.is_member })}
                className="rounded border border-[var(--border)] px-2 py-1 disabled:cursor-wait disabled:opacity-60"
              >
                {busy === `${r.id}:member`
                  ? r.is_member ? 'Revoking…' : 'Activating…'
                  : r.is_member ? 'Revoke' : 'Activate'}
              </button>
              <button
                disabled={busy?.startsWith(`${r.id}:`)}
                aria-busy={busy === `${r.id}:role`}
                onClick={() => update(r.id, 'role', { role: r.role === 'admin' ? 'member' : 'admin' })}
                className="rounded border border-[var(--border)] px-2 py-1 disabled:cursor-wait disabled:opacity-60"
              >
                {busy === `${r.id}:role`
                  ? r.role === 'admin' ? 'Demoting…' : 'Promoting…'
                  : r.role === 'admin' ? 'Demote' : 'Promote'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
