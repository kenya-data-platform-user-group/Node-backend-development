import { z } from 'zod';

export const PostsQuerySchema = z.object({
  published: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  author: z.string().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PostsQueryDto = z.infer<typeof PostsQuerySchema>;
