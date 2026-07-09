import { createSupabaseServerClient } from '@/lib/supabase/server';
import { relativeTime } from '@/lib/time';

interface FeedbackRow {
  id: string;
  created_by: string;
  kind: 'bug' | 'feature';
  body: string;
  page_context: string | null;
  created_at: string;
}

/** Admin-only via RLS (feedback_select_admin); non-admins see an empty list. */
export default async function AdminFeedbackPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('feedback')
    .select('id, created_by, kind, body, page_context, created_at')
    .order('created_at', { ascending: false })
    // Cap the triage view — a flood of inserts must not turn this page into a
    // multi-MB render. Older rows stay queryable in the DB.
    .limit(200);
  const rows = (data ?? []) as FeedbackRow[];

  const authorIds = Array.from(new Set(rows.map((r) => r.created_by)));
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', authorIds)
    : { data: [] };
  const nameOf = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={
                    r.kind === 'bug'
                      ? 'rounded-full bg-[var(--color-terracotta-500)]/10 px-2 py-0.5 font-medium text-[var(--color-terracotta-500)]'
                      : 'rounded-full bg-[var(--primary)]/10 px-2 py-0.5 font-medium text-[var(--primary)]'
                  }
                >
                  {r.kind === 'bug' ? 'Bug' : 'Feature'}
                </span>
                <span className="text-[var(--muted)]">
                  {nameOf.get(r.created_by) ?? 'Former member'} · {relativeTime(r.created_at)}
                  {r.page_context ? ` · on ${r.page_context}` : ''}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
