import { z } from 'zod';

export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000).optional(),
  })
  .strict();

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
