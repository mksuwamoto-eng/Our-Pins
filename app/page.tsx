import { AppShell } from '@/components/layout/AppShell';
import { MapView } from '@/components/map/MapView';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const [{ data: pins }, { data: categories }, { data: members }] = await Promise.all([
    supabase.from('pins').select('*').is('archived_at', null).order('created_at', { ascending: false }),
    // Categories are global config; admin client bypasses RLS.
    admin.from('categories').select('*').is('archived_at', null).order('sort_order'),
    supabase
      .from('profiles')
      .select('id, display_name')
      .eq('is_member', true)
      .is('archived_at', null)
      .order('display_name'),
  ]);

  // Only members who have pins — selecting a pin-less member would just
  // silently empty the map.
  const authorsWithPins = new Set((pins ?? []).map((p) => p.created_by));
  const memberOptions = (members ?? []).filter((m) => authorsWithPins.has(m.id));

  return (
    <AppShell>
      <MapView initialPins={pins ?? []} categories={categories ?? []} members={memberOptions} />
    </AppShell>
  );
}
