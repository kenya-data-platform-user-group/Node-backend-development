/**
 * Standalone seed script. Run with:
 *
 *   pnpm db:seed                 # additive, skips rows whose email already exists
 *   pnpm db:seed:reset           # TRUNCATE the table first (dev only!)
 *
 * Env loading: dotenv loads `.env.${NODE_ENV}` (then `.env`) from the project
 * root, so DATABASE_URL is populated the same way the running app gets it.
 * Override per run with `NODE_ENV=production pnpm db:seed`.
 */

import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envDir = join(__dirname, '..', '..', '..');
// Most specific first; first definition wins because override is false.
loadEnv({ path: join(envDir, `.env.${NODE_ENV}.local`), override: false });
loadEnv({ path: join(envDir, `.env.${NODE_ENV}`), override: false });
loadEnv({ path: join(envDir, '.env'), override: false });

import { employees } from '../../employees/schema/employee.schema';
import { employeeSeedData } from './employees.seed';

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
      console.log('▶ Truncating employees table…');
      // RESTART IDENTITY is harmless for UUID PKs; CASCADE handles future FKs.
      await pool.query('TRUNCATE TABLE employees RESTART IDENTITY CASCADE');
    }

    console.log(`▶ Inserting ${employeeSeedData.length} employees…`);
    const inserted = await db
      .insert(employees)
      .values(employeeSeedData)
      .onConflictDoNothing({ target: employees.email })
      .returning({ id: employees.id, email: employees.email });

    console.log(`✔ Inserted ${inserted.length} new row(s).`);
    if (inserted.length < employeeSeedData.length) {
      console.log(
        `  (${employeeSeedData.length - inserted.length} skipped — email already existed)`,
      );
    }
  } catch (err) {
    console.error('✖ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
