import { z } from 'zod';

/**
 * Schema for the 1:1 employee_profiles row. Used by both create (upsert) and
 * update — all fields are optional because a profile is "incremental data".
 */
export const upsertEmployeeProfileSchema = z
  .object({
    bio: z.string().max(2000).optional(),
    phone: z.string().trim().max(30).optional(),
    address: z.string().max(500).optional(),
    /** ISO date (YYYY-MM-DD) — Postgres `date` column. */
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD')
      .optional(),
  })
  .strict();

export type UpsertEmployeeProfileDto = z.infer<
  typeof upsertEmployeeProfileSchema
>;
