import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { defineConfig } from 'drizzle-kit';

// Load env files the same way the app and seed script do, so `pnpm db:*`
// commands pick up DATABASE_URL from .env.${NODE_ENV}[.local]. Most-specific
// first wins because override is false.
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envDir = __dirname;
loadEnv({ path: join(envDir, `.env.${NODE_ENV}.local`), override: false });
loadEnv({ path: join(envDir, `.env.${NODE_ENV}`), override: false });
loadEnv({ path: join(envDir, '.env'), override: false });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    `DATABASE_URL is not set. Create .env.${NODE_ENV} or .env.${NODE_ENV}.local at the project root.`,
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
