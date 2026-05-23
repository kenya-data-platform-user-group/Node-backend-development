import { z } from 'zod';

export const createEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.email().trim().toLowerCase().max(255),
    position: z.string().trim().min(1).max(100),
    departmentId: z.uuid().optional(),
    notes: z.string().max(2000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
