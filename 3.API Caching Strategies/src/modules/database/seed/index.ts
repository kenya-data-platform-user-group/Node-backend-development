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
const envDir = join(__dirname, '..', '..', '..', '..');
// Most specific first; first definition wins because override is false.
loadEnv({ path: join(envDir, `.env.${NODE_ENV}.local`), override: false });
loadEnv({ path: join(envDir, `.env.${NODE_ENV}`), override: false });
loadEnv({ path: join(envDir, '.env'), override: false });

import { events } from '../../events/schema/event.schema';
import { eventSeedData } from './events.seed';

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
      console.log('▶ Truncating events table...');
      await pool.query('TRUNCATE TABLE events RESTART IDENTITY CASCADE');
    }

    console.log(`▶ Inserting ${eventSeedData.length} events...`);
    const inserted = await db
      .insert(events)
      .values(eventSeedData)
      .onConflictDoNothing({ target: events.slug })
      .returning({ id: events.id, slug: events.slug });

    console.log(`✔ Inserted ${inserted.length} new row(s).`);
    if (inserted.length < eventSeedData.length) {
      console.log(
        `  (${eventSeedData.length - inserted.length} skipped - slug already existed)`,
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
