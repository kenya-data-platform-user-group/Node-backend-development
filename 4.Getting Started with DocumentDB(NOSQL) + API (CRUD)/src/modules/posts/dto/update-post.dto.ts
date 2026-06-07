import { z } from 'zod';

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;
