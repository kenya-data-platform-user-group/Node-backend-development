import { z } from 'zod';

export const projectSortFields = [
  'name',
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
] as const;

export const listProjectsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(projectSortFields).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().trim().min(1).max(100).optional(),
    isActive: z.coerce.boolean().optional(),
    /** Set true to embed `members` (with their `employee`) on each row. */
    includeMembers: z.coerce.boolean().optional(),
  })
  .strict();

export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
