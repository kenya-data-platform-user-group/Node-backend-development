import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { departments } from '../../departments/schema/department.schema';

/**
 * Drizzle table definition for `employees`.
 *
 * Relationships:
 *  - 1:N — `departments.id` ← `employees.department_id` (many employees per department)
 *  - 1:1 — `employees.id`   ← `employee_profiles.employee_id` (extended bio)
 *  - N:N — `employees` ↔ `projects` via `employee_projects` (role + allocation)
 */
export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    position: varchar('position', { length: 100 }).notNull(),

    // FK → departments.id. Nullable so employees can exist without a department.
    // ON DELETE SET NULL keeps the employee row if the department is removed.
    departmentId: uuid('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),

    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('employees_department_id_idx').on(t.departmentId)],
);

export type EmployeeRow = typeof employees.$inferSelect;
export type NewEmployeeRow = typeof employees.$inferInsert;
