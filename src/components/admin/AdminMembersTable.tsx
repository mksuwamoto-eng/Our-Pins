'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Row {
  id: string;
  display_name: string;
  is_member: boolean;
  role: string;
  created_at: string;
  archived_at: string | null;
  real_name: string | null;
}

export function AdminMembersTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(id: string, patch: Partial<Pick<Row, 'is_member' | 'role'>>) {
    setBusy(id);
    const supabase = getSupabaseBrowserClient();
    await supabase.from('profiles').update(patch).eq('id', id);
    router.refresh();
    setBusy(null);
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
                disabled={busy === r.id}
                onClick={() => update(r.id, { is_member: !r.is_member })}
                className="rounded border border-[var(--border)] px-2 py-1"
              >
                {r.is_member ? 'Revoke' : 'Activate'}
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => update(r.id, { role: r.role === 'admin' ? 'member' : 'admin' })}
                className="rounded border border-[var(--border)] px-2 py-1"
              >
                {r.role === 'admin' ? 'Demote' : 'Promote'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
