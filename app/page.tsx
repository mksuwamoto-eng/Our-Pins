import { AppShell } from '@/components/layout/AppShell';
import { MapView } from '@/components/map/MapView';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const [{ data: pins }, { data: categories }] = await Promise.all([
    supabase.from('pins').select('*').is('archived_at', null).order('created_at', { ascending: false }),
    // Categories are global config; admin client bypasses RLS.
    admin.from('categories').select('*').is('archived_at', null).order('sort_order'),
  ]);

  return (
    <AppShell>
      <MapView initialPins={pins ?? []} categories={categories ?? []} />
    </AppShell>
  );
}
