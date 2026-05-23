import { z } from 'zod';

export const departmentSortFields = ['name', 'createdAt', 'updatedAt'] as const;

export const listDepartmentsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(departmentSortFields).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().trim().min(1).max(100).optional(),
    /** Set true to embed the employees array (1:N child) on each row. */
    includeEmployees: z.coerce.boolean().optional(),
  })
  .strict();

export type ListDepartmentsDto = z.infer<typeof listDepartmentsSchema>;
