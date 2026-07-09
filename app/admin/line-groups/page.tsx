import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLineGroups } from '@/components/admin/AdminLineGroups';

export default async function AdminLineGroupsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('line_groups')
    .select('group_id, label, digest_enabled, added_at, left_at')
    .order('added_at', { ascending: false });
  return <AdminLineGroups groups={data ?? []} />;
}
