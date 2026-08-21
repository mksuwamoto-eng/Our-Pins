import { z } from 'zod';

// Onboarding asks for a real first + last name and shows that on the map by
// default. A pseudonym is still allowed, but it's an explicit opt-in rather
// than the path of least resistance: the previous form asked for a free-text
// "display name" ("what other members see") alongside a full name marked
// "only admins see this", which reliably produced handles. In a closed
// community a recommendation is only worth something if you know who made it.
// Validation messages are stable codes (not display strings): the forms map
// them to localized text via the `onboarding.errors` message namespace, so a
// Greek-first member never sees English validation errors.
export const onboardingSchema = z
  .object({
    firstName: z.string().trim().min(1, 'firstNameRequired').max(40),
    lastName: z.string().trim().min(1, 'lastNameRequired').max(60),
    useNickname: z.boolean().default(false),
    nickname: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    email: z.string().trim().email().optional(),
    avatarPath: z.string().optional().or(z.literal('').transform(() => undefined)),
    instagram: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, ''))
      // Must match the DB CHECK constraint on profiles.instagram exactly,
      // or the save fails with a raw 500 after passing app validation.
      .refine((v) => /^[a-zA-Z0-9._]{1,30}$/.test(v), {
        message: 'instagramInvalid',
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
    linkedin: z
      .string()
      .trim()
      .max(200)
      // People paste whatever the browser shows, with or without a scheme.
      // Normalise first, then check the host — the DB CHECK is https-only and
      // linkedin.com-only, and would 500 on anything that slipped through.
      .transform((v) => (v ? `https://${v.replace(/^https?:\/\//i, '')}` : v))
      .refine((v) => !v || /^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/.+/i.test(v), {
        message: 'linkedinInvalid',
      })
      .optional()
      .or(z.literal('').transform(() => undefined)),
    bio: z
      .string()
      .trim()
      .max(500, 'bioTooLong')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    acceptedGuidelines: z.literal(true, {
      errorMap: () => ({ message: 'guidelinesRequired' }),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.useNickname && !v.nickname) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nickname'],
        message: 'nicknameRequired',
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
  linkedin: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(500).optional(),
  realName: z.string().trim().max(120).optional(),
  avatarPath: z.string().optional(),
  instagram: z.string().trim().optional(),
  website: z.string().trim().max(200).optional(),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;
