import { z } from 'zod';

// Upper bound on how far out an invite may be set to expire. Long-lived links
// are the point (a group announcement link should outlive the announcement),
// but an accidental decade-long link is worth blocking.
export const INVITE_MAX_EXPIRY_DAYS = 365;

export const inviteCreateSchema = z.object({
  // `.optional()` alone would accept '' and store an empty-string note; the
  // transform is what actually makes a blank field absent.
  note: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  // How many separate links to mint. Unrelated to maxUses: `count` is "give me
  // 5 different tokens", `maxUses` is "this one token admits 5 people".
  count: z.number().int().min(1).max(20).default(1),
  maxUses: z.number().int().min(1).max(1000).default(1),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .refine((v) => v === undefined || new Date(v).getTime() > Date.now(), {
      message: 'Expiry must be in the future',
    })
    .refine(
      (v) =>
        v === undefined ||
        new Date(v).getTime() <= Date.now() + INVITE_MAX_EXPIRY_DAYS * 86_400_000,
      { message: `Expiry cannot be more than ${INVITE_MAX_EXPIRY_DAYS} days away` },
    ),
});

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

export const inviteAcceptSchema = z.object({
  token: z.string().uuid(),
});

export const INVITE_COOKIE = 'our_pins_invite';
