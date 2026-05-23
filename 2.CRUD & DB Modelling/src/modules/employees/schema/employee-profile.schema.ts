import { sql } from 'drizzle-orm';
import {
  date,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { employees } from './employee.schema';

/**
 * `employee_profiles` — child side of a 1:1 relationship with `employees`.
 *
 * The 1:1 is enforced at the schema level by making `employee_id` BOTH the
 * primary key AND a foreign key. That guarantees at most one profile per
 * employee without an extra unique index.
 *
 * `onDelete: 'cascade'` so removing the parent employee removes the profile.
 */
export const employeeProfiles = pgTable('employee_profiles', {
  employeeId: uuid('employee_id')
    .primaryKey()
    .references(() => employees.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  phone: varchar('phone', { length: 30 }),
  address: text('address'),
  dateOfBirth: date('date_of_birth'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type EmployeeProfileRow = typeof employeeProfiles.$inferSelect;
export type NewEmployeeProfileRow = typeof employeeProfiles.$inferInsert;
