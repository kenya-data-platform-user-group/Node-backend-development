import { z } from 'zod';

/**
 * Whitelisted columns the client may sort by. Restricting this prevents
 * arbitrary column names from reaching the SQL layer.
 */
export const employeeSortFields = [
  'createdAt',
  'updatedAt',
  'firstName',
  'lastName',
  'email',
  'position',
  'department',
] as const;

export const listEmployeesSchema = z
  .object({
    // Pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.enum(employeeSortFields).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Filtering
    search: z.string().trim().min(1).max(100).optional(), // matches first/last name + email
    department: z.string().trim().min(1).max(100).optional(),
    position: z.string().trim().min(1).max(100).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .strict();

export type ListEmployeesDto = z.infer<typeof listEmployeesSchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
