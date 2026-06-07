import { z } from 'zod';

export const CreateCommentSchema = z.object({
  author: z.string().min(1),
  content: z.string().min(1).max(1000),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
