import { AppShell } from '@/components/layout/AppShell';
import { MapView } from '@/components/map/MapView';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: pins }, { data: categories }] = await Promise.all([
    supabase.from('pins').select('*').is('archived_at', null).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').is('archived_at', null).order('sort_order'),
  ]);

  return (
    <AppShell>
      <MapView initialPins={pins ?? []} categories={categories ?? []} />
    </AppShell>
  );
}
