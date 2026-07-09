import { z } from 'zod';

export const RESOURCE_CATEGORIES = ['how_to', 'watch', 'read', 'other'] as const;

// DB CHECK is `url ~* '^https://'` (https only), same as profiles.website.
// A bare host gets a scheme; an explicit http:// is upgraded to https:// so
// it can't 500 at the DB after passing validation.
// Empty string must become undefined HERE, not just via an `.or(literal(''))`
// escape hatch — that branch never runs (the main branch accepts ''), and ''
// violates the DB CHECK (the profiles.instagram lesson).
// The 500-char limit is checked AFTER the transform: the DB CHECK measures
// the stored value, and prepending https:// grows a 493+ char bare host past
// it (Zod-passes-but-CHECK-rejects → opaque 500).
const urlField = z
  .string()
  .trim()
  .max(520)
  .transform((v) => (v ? `https://${v.replace(/^https?:\/\//i, '')}` : undefined))
  .refine((v) => !v || v.length <= 500, { message: 'Link is too long (max 500 characters)' })
  .optional();

export const resourceCreateSchema = z.object({
  category: z.enum(RESOURCE_CATEGORIES),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  url: urlField,
});

// Edit is a full replace of the editable fields (the form always submits all
// of them); a cleared url comes through as undefined and is stored as null.
export const resourceUpdateSchema = resourceCreateSchema;

export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
