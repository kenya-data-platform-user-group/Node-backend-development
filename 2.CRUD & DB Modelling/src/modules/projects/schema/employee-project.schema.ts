import { sql } from 'drizzle-orm';
import {
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { employees } from '../../employees/schema/employee.schema';
import { projects } from './project.schema';

/**
 * `employee_projects` — junction table for the N:N relationship between
 * `employees` and `projects`.
 *
 * Notes:
 *  - Composite primary key on `(employee_id, project_id)` natively prevents
 *    a duplicate assignment without needing a separate unique index.
 *  - Both FKs cascade so removing either parent cleans up assignments.
 *  - Extra columns on the link (`role`, `allocation`) are the textbook
 *    reason the junction is its own entity rather than an implicit array.
 */
export const employeeProjects = pgTable(
  'employee_projects',
  {
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 100 }).notNull(),
    /** Percentage allocation of the employee to this project, 0–100. */
    allocation: integer('allocation').notNull().default(100),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.projectId] })],
);

export type EmployeeProjectRow = typeof employeeProjects.$inferSelect;
export type NewEmployeeProjectRow = typeof employeeProjects.$inferInsert;
