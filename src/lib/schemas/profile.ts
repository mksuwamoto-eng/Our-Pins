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
  avatarPath: z.string().min(1, 'Upload a profile photo'),
  displayPref: z.enum(['avatar_only', 'avatar_name']),
  instagram: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._]{1,30}$/, 'Use letters, numbers, dot or underscore')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  website: z
    .string()
    .trim()
    .regex(/^https:\/\//, 'URL must start with https://')
    .url()
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
