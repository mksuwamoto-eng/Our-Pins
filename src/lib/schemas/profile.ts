import { z } from 'zod';

// Onboarding asks for a real first + last name and shows that on the map by
// default. A pseudonym is still allowed, but it's an explicit opt-in rather
// than the path of least resistance: the previous form asked for a free-text
// "display name" ("what other members see") alongside a full name marked
// "only admins see this", which reliably produced handles. In a closed
// community a recommendation is only worth something if you know who made it.
export const onboardingSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Please enter your first name').max(40),
    lastName: z.string().trim().min(1, 'Please enter your surname').max(60),
    useNickname: z.boolean().default(false),
    nickname: z
      .string()
      .trim()
      .max(60)
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
      // DB CHECK is `website ~* '^https://'` (https only). A bare host gets a
      // scheme; an explicit http:// is upgraded to https:// so it can't 500 at
      // the DB after passing validation.
      .transform((v) => (v ? `https://${v.replace(/^https?:\/\//i, '')}` : v))
      .optional()
      .or(z.literal('').transform(() => undefined)),
    acceptedGuidelines: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the community guidelines to continue.' }),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.useNickname && !v.nickname) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nickname'],
        message: 'Enter the name you want shown, or untick the box',
      });
    }
  });

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingValues = z.output<typeof onboardingSchema>;

/** The full name stored privately, and the name everyone sees. */
export function resolveNames(v: OnboardingValues): { realName: string; displayName: string } {
  const realName = `${v.firstName} ${v.lastName}`.trim();
  return { realName, displayName: v.useNickname && v.nickname ? v.nickname : realName };
}

// Kept independent of onboardingSchema: /settings/profile edits the resolved
// display name directly, since by then the first/last split has already been
// turned into one stored name.
export const profileEditSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  realName: z.string().trim().max(120).optional(),
  avatarPath: z.string().optional(),
  displayPref: z.enum(['avatar_only', 'avatar_name']).optional(),
  instagram: z.string().trim().optional(),
  website: z.string().trim().max(200).optional(),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;
