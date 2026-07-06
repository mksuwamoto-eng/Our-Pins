import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  // Trailing slash stripped: callers append `/path`, and LINE exact-matches
  // the registered redirect_uri, so `https://host//path` would be rejected.
  NEXT_PUBLIC_SITE_URL: z.string().url().transform((s) => s.replace(/\/+$/, '')),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  LINE_CHANNEL_ID: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  // Optional: Messaging API channel (the Parea LINE bot). Separate channel —
  // and separate secret — from the LINE Login channel above, but it must live
  // under the same LINE provider so webhook userIds match line_sub.
  LINE_MESSAGING_CHANNEL_SECRET: z.string().min(1).optional(),
  LINE_MESSAGING_ACCESS_TOKEN: z.string().min(1).optional(),
  // The one group the bot answers in; until set, group messages are ignored.
  LINE_GROUP_ID: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  // Optional: the Parea Concierge returns 503 until this is set.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CONCIERGE_MONTHLY_BUDGET_USD: z.coerce.number().positive().optional(),
  // Optional: shared community Drive folder linked from the header "Files"
  // nav item. Kept server-only (not NEXT_PUBLIC_) and out of the repo so the
  // folder URL isn't readable by anyone who isn't a signed-in member — the
  // nav item is simply omitted until this is set.
  COMMUNITY_FILES_URL: z.string().url().optional(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv called on the client');
  }
  return serverSchema.parse(process.env);
}
