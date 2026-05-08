import { z } from 'zod';

export const inviteCreateSchema = z.object({
  note: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  count: z.number().int().min(1).max(20).default(1),
});

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

export const inviteAcceptSchema = z.object({
  token: z.string().uuid(),
});

export const INVITE_COOKIE = 'our_pins_invite';
