-- 0026: log Parea's answer text alongside the question.
--
-- concierge_queries (0013) already records the question, asker id, token
-- counts, and cost. This adds the model's reply so admins can review what the
-- bot actually said — useful for stats and spotting abuse patterns. Written by
-- the same service-role UPDATE that records token usage/cost after the model
-- responds (src/lib/concierge/ask.ts), so it stays null for reserved-but-never-
-- answered rows (guard failures, model errors). Disclosed in the privacy policy.
--
-- Still service-role-only: RLS was enabled with no policies on this table in
-- 0013 and that is unchanged here.

alter table public.concierge_queries
  add column answer text;
