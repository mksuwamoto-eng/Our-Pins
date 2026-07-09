'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LineGroup } from '@/lib/supabase/types';

export function AdminLineGroups({ groups }: { groups: LineGroup[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(group_id: string, body: { label?: string; digest_enabled?: boolean }) {
    setBusy(group_id);
    try {
      await fetch('/api/admin/line-groups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id, ...body }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!groups.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No groups yet. Add the Parea bot to a LINE group — it’ll appear here once
        it joins (or sees a message, for a group it’s already in). Make sure
        “Allow bot to join group chats” is on in the LINE console.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        The weekly digest is pushed to every group with the digest on. Groups are
        independent — the same digest goes to each separately.
      </p>
      <ul className="space-y-2">
        {groups.map((g) => {
          const left = !!g.left_at;
          return (
            <li key={g.group_id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  defaultValue={g.label ?? ''}
                  placeholder="Label this group…"
                  maxLength={80}
                  disabled={busy === g.group_id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (g.label ?? '')) patch(g.group_id, { label: v });
                  }}
                  className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1"
                />
                <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">{g.group_id}</p>
                {left && (
                  <p className="text-xs text-[var(--muted)]">
                    Bot removed — won’t receive the digest until re-added.
                  </p>
                )}
              </div>
              <button
                disabled={busy === g.group_id || left}
                aria-busy={busy === g.group_id}
                onClick={() => patch(g.group_id, { digest_enabled: !g.digest_enabled })}
                className="rounded border border-[var(--border)] px-3 py-1 disabled:cursor-wait disabled:opacity-60"
              >
                {g.digest_enabled ? 'Digest: on' : 'Digest: off'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
