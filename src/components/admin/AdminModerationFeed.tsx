'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

interface Row {
  id: string;
  name: string;
  address: string;
  created_at: string;
  archived_at: string | null;
  created_by: string;
}

export function AdminModerationFeed({ pins, showArchived }: { pins: Row[]; showArchived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleArchive(id: string, archived: boolean) {
    setBusy(id);
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('pins')
      .update({ archived_at: archived ? null : new Date().toISOString() })
      .eq('id', id);
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-3">
      <Link
        href={showArchived ? '/admin/moderation' : '/admin/moderation?archived=1'}
        className="text-xs text-[var(--muted)] underline"
      >
        {showArchived ? 'Hide archived' : 'Include archived'}
      </Link>
      <ul className="space-y-2">
        {pins.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3 text-sm">
            <div className="flex-1">
              <Link href={`/pins/${p.id}`} className="font-medium underline">
                {p.name}
              </Link>
              <p className="text-[var(--muted)]">{p.address}</p>
            </div>
            <button
              disabled={busy === p.id}
              onClick={() => toggleArchive(p.id, !!p.archived_at)}
              className="rounded border border-[var(--border)] px-2 py-1"
            >
              {p.archived_at ? 'Restore' : 'Archive'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
