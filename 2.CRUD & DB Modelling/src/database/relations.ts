/**
 * Drizzle relational query API — declarations of relationships between tables.
 *
 * These are NOT enforced by the database; they're a TypeScript layer that
 * powers `db.query.<table>.findMany({ with: { ... } })`. Foreign keys still
 * live on the table definitions.
 *
 * Patterns demonstrated:
 *  - 1:N — declare `many()` on the parent + `one()` on the child.
 *  - 1:1 — declare `one()` on BOTH sides (Drizzle treats it as a special
 *          case of 1:N where the FK column is also unique).
 *  - N:N — both ends declare `many(<junction>)`; the junction declares
 *          `one()` to each side. Querying needs nested `with`.
 */
import { relations } from 'drizzle-orm';
import { departments } from '../modules/departments/schema/department.schema';
import { employeeProfiles } from '../modules/employees/schema/employee-profile.schema';
import { employees } from '../modules/employees/schema/employee.schema';
import { employeeProjects } from '../modules/projects/schema/employee-project.schema';
import { projects } from '../modules/projects/schema/project.schema';

// ─── Departments ────────────────────────────────────────────────────────────
// 1:N parent — one department, many employees.
export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
}));

// ─── Employees ──────────────────────────────────────────────────────────────
export const employeesRelations = relations(employees, ({ one, many }) => ({
  // 1:N child of departments
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  // 1:1 with employee_profiles (PK = FK on the child)
  profile: one(employeeProfiles, {
    fields: [employees.id],
    references: [employeeProfiles.employeeId],
  }),
  // N:N with projects — via the junction table.
  // To reach the project itself in queries, nest:
  //   with: { projects: { with: { project: true } } }
  projects: many(employeeProjects),
}));

// ─── EmployeeProfiles ───────────────────────────────────────────────────────
// 1:1 child — back-reference to its parent employee.
export const employeeProfilesRelations = relations(
  employeeProfiles,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeProfiles.employeeId],
      references: [employees.id],
    }),
  }),
);

// ─── Projects ───────────────────────────────────────────────────────────────
// N:N — the project's "members" come through the junction.
export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(employeeProjects),
}));

// ─── EmployeeProjects (junction) ────────────────────────────────────────────
// Two `one()` references — one to each side of the N:N.
export const employeeProjectsRelations = relations(
  employeeProjects,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeProjects.employeeId],
      references: [employees.id],
    }),
    project: one(projects, {
      fields: [employeeProjects.projectId],
      references: [projects.id],
    }),
  }),
);
