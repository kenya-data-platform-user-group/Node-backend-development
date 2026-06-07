import { z } from 'zod';

export const CommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CommentsQueryDto = z.infer<typeof CommentsQuerySchema>;
