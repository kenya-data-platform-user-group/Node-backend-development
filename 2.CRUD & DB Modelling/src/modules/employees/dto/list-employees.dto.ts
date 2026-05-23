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
] as const;

export const employeeIncludeFields = [
  'department',
  'profile',
  'projects',
] as const;
export type EmployeeInclude = (typeof employeeIncludeFields)[number];

/**
 * Parses a comma-separated `include=department,profile,projects` query string
 * into a typed array. Unknown values fail validation.
 */
const includeSchema = z
  .string()
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(employeeIncludeFields)));

export const listEmployeesSchema = z
  .object({
    // Pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.enum(employeeSortFields).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Filtering
    search: z.string().trim().min(1).max(100).optional(),
    departmentId: z.string().uuid().optional(),
    position: z.string().trim().min(1).max(100).optional(),
    isActive: z.coerce.boolean().optional(),

    // Eager loading (opt-in)
    include: includeSchema.optional(),
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
