import { createSupabaseAdminClient } from '@/lib/supabase/server';
import {
  AdminModerationFeed,
  type ModRow,
  type ModSection,
} from '@/components/admin/AdminModerationFeed';

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === '1';

  // Admin client so archived rows are visible even where a table only exposes
  // them to their creator (the page is already behind the /admin gate).
  const admin = createSupabaseAdminClient();

  let pinsQ = admin
    .from('pins')
    .select('id, name, address, archived_at')
    .order('created_at', { ascending: false })
    .limit(100);
  let postsQ = admin
    .from('board_posts')
    .select('id, title, category, archived_at')
    .order('created_at', { ascending: false })
    .limit(100);
  let resourcesQ = admin
    .from('resources')
    .select('id, title, category, archived_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (!showArchived) {
    pinsQ = pinsQ.is('archived_at', null);
    postsQ = postsQ.is('archived_at', null);
    resourcesQ = resourcesQ.is('archived_at', null);
  }

  const [{ data: pins }, { data: posts }, { data: resources }] = await Promise.all([
    pinsQ,
    postsQ,
    resourcesQ,
  ]);

  const sections: ModSection[] = [
    {
      table: 'pins',
      label: 'Pins',
      rows: (pins ?? []).map(
        (p): ModRow => ({
          id: p.id,
          title: p.name,
          subtitle: p.address,
          archived_at: p.archived_at,
          href: `/pins/${p.id}`,
        }),
      ),
    },
    {
      table: 'board_posts',
      label: 'Board posts',
      rows: (posts ?? []).map(
        (p): ModRow => ({
          id: p.id,
          title: p.title,
          subtitle: p.category,
          archived_at: p.archived_at,
        }),
      ),
    },
    {
      table: 'resources',
      label: 'Resources',
      rows: (resources ?? []).map(
        (r): ModRow => ({
          id: r.id,
          title: r.title,
          subtitle: r.category,
          archived_at: r.archived_at,
        }),
      ),
    },
  ];

  return <AdminModerationFeed sections={sections} showArchived={showArchived} />;
}
