/**
 * Aggregates every Drizzle schema defined under feature folders so they can be
 * imported as a single namespace by both the runtime client and drizzle-kit.
 *
 * Re-exporting the relations file in the same barrel hooks them into the
 * relational query API on `db.query.*`.
 */
export * from '../modules/departments/schema/department.schema';
export * from '../modules/employees/schema/employee.schema';
export * from '../modules/employees/schema/employee-profile.schema';
export * from '../modules/projects/schema/project.schema';
export * from '../modules/projects/schema/employee-project.schema';
export * from './relations';
