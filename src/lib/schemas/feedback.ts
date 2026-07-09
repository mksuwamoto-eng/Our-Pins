import { z } from 'zod';

export const FEEDBACK_KINDS = ['bug', 'feature'] as const;

export const feedbackCreateSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  body: z.string().trim().min(1).max(2000),
  // Empty string must become undefined (the DB CHECK / empty-string lesson).
  // Must look like an app pathname — it renders as trusted metadata on the
  // admin page, so an arbitrary string (a lure URL, another member's name)
  // is rejected rather than stored. Invalid values are dropped, not 400'd:
  // the report body is what matters.
  pageContext: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v && /^\/[a-zA-Z0-9/_?=&.%~-]*$/.test(v) ? v : undefined))
    .optional(),
});

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>;
