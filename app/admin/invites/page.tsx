import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminInvitesPanel } from '@/components/admin/AdminInvitesPanel';

export default async function AdminInvitesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  return <AdminInvitesPanel invites={invites ?? []} />;
}
