import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().max(2000).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
