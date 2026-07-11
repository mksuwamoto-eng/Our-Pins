'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type ModTable = 'pins' | 'board_posts' | 'resources';

export interface ModRow {
  id: string;
  title: string;
  subtitle: string;
  archived_at: string | null;
  href?: string;
}

export interface ModSection {
  table: ModTable;
  label: string;
  rows: ModRow[];
}

export function AdminModerationFeed({
  sections,
  showArchived,
}: {
  sections: ModSection[];
  showArchived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleArchive(table: ModTable, id: string, isArchived: boolean) {
    setBusy(id);
    await fetch('/api/admin/moderation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table, id, archive: !isArchived }),
    });
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <Link
        href={showArchived ? '/admin/moderation' : '/admin/moderation?archived=1'}
        className="text-xs text-[var(--muted)] underline"
      >
        {showArchived ? 'Hide archived' : 'Include archived'}
      </Link>

      {sections.map((section) => (
        <div key={section.table} className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">
            {section.label} ({section.rows.length})
          </h2>
          {section.rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing here.</p>
          ) : (
            <ul className="space-y-2">
              {section.rows.map((r) => (
                <li key={r.id} className="card flex items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    {r.href ? (
                      <Link href={r.href} className="font-medium underline">
                        {r.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.title}</span>
                    )}
                    <p className="truncate text-[var(--muted)]">{r.subtitle}</p>
                  </div>
                  {r.archived_at ? (
                    <span className="shrink-0 text-xs text-[var(--muted)]">archived</span>
                  ) : null}
                  <button
                    disabled={busy === r.id}
                    aria-busy={busy === r.id}
                    onClick={() => toggleArchive(section.table, r.id, !!r.archived_at)}
                    className="shrink-0 rounded border border-[var(--border)] px-2 py-1 disabled:cursor-wait disabled:opacity-60"
                  >
                    {busy === r.id
                      ? r.archived_at
                        ? 'Restoring…'
                        : 'Archiving…'
                      : r.archived_at
                        ? 'Restore'
                        : 'Archive'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
