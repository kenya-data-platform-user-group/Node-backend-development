import { z } from 'zod';

/**
 * Body for `POST /projects/:id/members` — assigns an employee to the project
 * with extra link metadata stored on the junction row.
 */
export const assignMemberSchema = z
  .object({
    employeeId: z.uuid(),
    role: z.string().trim().min(1).max(100),
    allocation: z.coerce.number().int().min(0).max(100).default(100),
  })
  .strict();

export type AssignMemberDto = z.infer<typeof assignMemberSchema>;

/**
 * Body for `PATCH /projects/:id/members/:employeeId` — partial update of the
 * link row only (cannot change which employee/project the row points at).
 */
export const updateMemberSchema = z
  .object({
    role: z.string().trim().min(1).max(100).optional(),
    allocation: z.coerce.number().int().min(0).max(100).optional(),
  })
  .strict();

export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
