import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminMembersTable } from '@/components/admin/AdminMembersTable';

export default async function AdminMembersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, is_member, role, created_at, archived_at')
    .order('created_at', { ascending: false });

  const { data: privates } = await supabase
    .from('private_profiles')
    .select('id, real_name, email');
  const realNameById = new Map((privates ?? []).map((p) => [p.id, p.real_name]));

  return (
    <AdminMembersTable
      rows={(members ?? []).map((m) => ({
        ...m,
        real_name: realNameById.get(m.id) ?? null,
      }))}
    />
  );
}
