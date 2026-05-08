import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminModerationFeed } from '@/components/admin/AdminModerationFeed';

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === '1';

  const supabase = await createSupabaseServerClient();
  let query = supabase.from('pins').select('id, name, address, created_at, archived_at, created_by').order('created_at', { ascending: false }).limit(100);
  if (!showArchived) query = query.is('archived_at', null);
  const { data: pins } = await query;

  return <AdminModerationFeed pins={pins ?? []} showArchived={showArchived} />;
}
