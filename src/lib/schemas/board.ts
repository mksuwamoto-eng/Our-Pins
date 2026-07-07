import { z } from 'zod';

export const BOARD_CATEGORIES = ['job', 'housing', 'for_sale', 'event', 'other'] as const;

export const boardPostCreateSchema = z.object({
  category: z.enum(BOARD_CATEGORIES),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
});

export type BoardPostCreateInput = z.infer<typeof boardPostCreateSchema>;
