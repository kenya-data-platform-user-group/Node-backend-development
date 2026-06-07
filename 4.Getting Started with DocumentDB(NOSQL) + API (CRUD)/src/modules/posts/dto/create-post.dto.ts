import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  author: z.string().min(1),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});

export type CreatePostDto = z.infer<typeof CreatePostSchema>;
