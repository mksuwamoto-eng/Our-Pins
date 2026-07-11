'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';

/**
 * Mobile-only (`md:hidden`) collapse of the header nav row. On phones the
 * inline nav in AppShell is hidden and this burger takes its place; the links
 * live in a dropdown using the same outside-click pattern as CategoryFilter /
 * HelpMenu. Data (files URL, admin role) is resolved in the server AppShell and
 * passed down as props so this stays a thin client shell.
 */
export function MobileNav({
  filesUrl,
  isAdmin,
}: {
  filesUrl: string | null;
  isAdmin: boolean;
}) {
  const t = useTranslations('app');
  const tAdmin = useTranslations('admin');
  const tSettings = useTranslations('settings');
  const tActivity = useTranslations('activity');
  const tMembers = useTranslations('members');
  const tBoard = useTranslations('board');
  const tResources = useTranslations('resources');
  const tHeader = useTranslations('header');

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const itemClass =
    'block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-subtle)]';

  return (
    <div ref={ref} className="relative flex items-center md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={tHeader('openMenu')}
        title={tHeader('openMenu')}
        className="text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <nav
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg"
        >
          <Link href="/activity" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tActivity('title')}
          </Link>
          <Link href="/board" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tBoard('navTitle')}
          </Link>
          <Link href="/resources" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tResources('navTitle')}
          </Link>
          <Link href="/members" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tMembers('title')}
          </Link>
          {filesUrl ? (
            <a
              href={filesUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              {t('files')} <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          {isAdmin ? (
            <Link
              href="/admin/members"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              {tAdmin('title')}
            </Link>
          ) : null}
          <Link href="/settings" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            {tSettings('title')}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
