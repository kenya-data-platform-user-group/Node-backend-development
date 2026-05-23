/**
 * Standalone seed script. Run with:
 *
 *   pnpm db:seed                 # additive (skips rows whose unique key exists)
 *   pnpm db:seed:reset           # TRUNCATE all tables first (dev only!)
 *
 * Seeds in dependency order:
 *   1. departments
 *   2. employees (resolves departmentName -> departmentId)
 *   3. projects
 *   4. employee_projects (a few sample assignments)
 */

import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { Pool } from 'pg';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envDir = join(__dirname, '..', '..', '..');
loadEnv({ path: join(envDir, `.env.${NODE_ENV}.local`), override: false });
loadEnv({ path: join(envDir, `.env.${NODE_ENV}`), override: false });
loadEnv({ path: join(envDir, '.env'), override: false });

import { departments } from '../../modules/departments/schema/department.schema';
import { employees } from '../../modules/employees/schema/employee.schema';
import { projects } from '../../modules/projects/schema/project.schema';
import { employeeProjects } from '../../modules/projects/schema/employee-project.schema';
import { departmentSeedData } from './departments.seed';
import { employeeSeedData } from './employees.seed';
import { projectSeedData } from './projects.seed';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('✖ DATABASE_URL is not set');
    process.exit(1);
  }

  const reset = process.argv.includes('--reset');
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    if (reset) {
      console.log('▶ Truncating all tables…');
      // CASCADE handles the FKs across the four tables.
      await pool.query(
        'TRUNCATE TABLE employee_projects, employee_profiles, employees, projects, departments RESTART IDENTITY CASCADE',
      );
    }

    // 1. Departments
    console.log(`▶ Seeding ${departmentSeedData.length} departments…`);
    await db
      .insert(departments)
      .values(departmentSeedData)
      .onConflictDoNothing({ target: departments.name });

    const deptRows = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(
        inArray(
          departments.name,
          departmentSeedData.map((d) => d.name),
        ),
      );
    const deptByName = new Map(deptRows.map((d) => [d.name, d.id]));

    // 2. Employees — substitute departmentId
    const employeeRows = employeeSeedData.map(
      ({ departmentName, ...rest }) => ({
        ...rest,
        departmentId: departmentName ? deptByName.get(departmentName) : null,
      }),
    );
    console.log(`▶ Seeding ${employeeRows.length} employees…`);
    const insertedEmployees = await db
      .insert(employees)
      .values(employeeRows)
      .onConflictDoNothing({ target: employees.email })
      .returning({ id: employees.id, email: employees.email });
    console.log(`  ✔ Inserted ${insertedEmployees.length} new employee(s).`);

    // 3. Projects
    console.log(`▶ Seeding ${projectSeedData.length} projects…`);
    await db
      .insert(projects)
      .values(projectSeedData)
      .onConflictDoNothing({ target: projects.name });

    // 4. Sample assignments (N:N) — only when reset (avoid dup PK errors)
    if (reset) {
      const allEmployees = await db
        .select({ id: employees.id, email: employees.email })
        .from(employees);
      const empByEmail = new Map(allEmployees.map((e) => [e.email, e.id]));

      const allProjects = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects);
      const projByName = new Map(allProjects.map((p) => [p.name, p.id]));

      const assignments = [
        {
          email: 'jane.doe@example.com',
          project: 'Atlas Platform v2',
          role: 'Tech Lead',
          allocation: 80,
        },
        {
          email: 'liam.nguyen@example.com',
          project: 'Atlas Platform v2',
          role: 'Senior Engineer',
          allocation: 100,
        },
        {
          email: 'sofia.garcia@example.com',
          project: 'Atlas Platform v2',
          role: 'Engineer',
          allocation: 100,
        },
        {
          email: 'mia.patel@example.com',
          project: 'Mobile Companion App',
          role: 'Engineer',
          allocation: 100,
        },
        {
          email: 'liam.nguyen@example.com',
          project: 'Mobile Companion App',
          role: 'Engineer',
          allocation: 20,
        },
        {
          email: 'alice.brown@example.com',
          project: 'Atlas Platform v2',
          role: 'Lead Designer',
          allocation: 50,
        },
        {
          email: 'alice.brown@example.com',
          project: 'Mobile Companion App',
          role: 'Designer',
          allocation: 50,
        },
        {
          email: 'isabella.lewis@example.com',
          project: 'Q3 Lead-Gen Campaign',
          role: 'Campaign Lead',
          allocation: 80,
        },
        {
          email: 'mason.hall@example.com',
          project: 'Q3 Lead-Gen Campaign',
          role: 'Content',
          allocation: 100,
        },
      ]
        .map((a) => ({
          employeeId: empByEmail.get(a.email),
          projectId: projByName.get(a.project),
          role: a.role,
          allocation: a.allocation,
        }))
        .filter(
          (
            a,
          ): a is {
            employeeId: string;
            projectId: string;
            role: string;
            allocation: number;
          } => !!a.employeeId && !!a.projectId,
        );

      if (assignments.length > 0) {
        console.log(`▶ Seeding ${assignments.length} project assignments…`);
        await db
          .insert(employeeProjects)
          .values(assignments)
          .onConflictDoNothing();
      }
    }

    // Suppress unused-import warning when not reset path runs
    void eq;

    console.log('✔ Seed complete.');
  } catch (err) {
    console.error('✖ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
