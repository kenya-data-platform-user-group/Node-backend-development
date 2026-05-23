import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/**
 * Update DTO is defined independently rather than `.partial()` of the create
 * schema because the create schema uses `.refine()` (which strips `.partial()`).
 */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().max(2000).nullable().optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
