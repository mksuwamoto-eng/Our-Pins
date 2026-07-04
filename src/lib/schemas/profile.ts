import { z } from 'zod';

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  realName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  email: z.string().trim().email().optional(),
  avatarPath: z.string().optional().or(z.literal('').transform(() => undefined)),
  displayPref: z.enum(['avatar_only', 'avatar_name']),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, ''))
    // Must match the DB CHECK constraint on profiles.instagram exactly,
    // or the save fails with a raw 500 after passing app validation.
    .refine((v) => /^[a-zA-Z0-9._]{1,30}$/.test(v), {
      message: 'Instagram handles use letters, numbers, dots and underscores (max 30)',
    })
    .optional()
    .or(z.literal('').transform(() => undefined)),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  acceptedGuidelines: z.literal(true, {
    errorMap: () => ({ message: 'Please accept the community guidelines to continue.' }),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profileEditSchema = onboardingSchema
  .omit({ acceptedGuidelines: true, email: true })
  .partial()
  .extend({
    displayPref: z.enum(['avatar_only', 'avatar_name']).optional(),
  });

export type ProfileEditInput = z.infer<typeof profileEditSchema>;
