import { AppShell } from '@/components/layout/AppShell';
import { PinForm } from '@/components/pins/PinForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function NewPinPage() {
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .is('archived_at', null)
    .order('sort_order');

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-4 font-serif text-2xl">Add a pin</h1>
        <PinForm categories={categories ?? []} />
      </div>
    </AppShell>
  );
}
