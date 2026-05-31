import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  node_env: z.enum(['development', 'production']).default('development'),
  db_user: z.string().default('postgres'),
  db_password: z.string().default('postgres'),
  db_host: z.string().default('localhost'),
  db_port: z.coerce.number().default(5432),
  database_url: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/event_cache_db'),
  redis_url: z.string().default('redis://localhost:6379'),
  cache_ttl_ms: z.coerce.number().int().positive().default(60000),
  cache_detail_ttl_ms: z.coerce.number().int().positive().default(120000),
  cache_version_ttl_ms: z.coerce.number().int().positive().default(86400000),
});

export type Config = z.infer<typeof configSchema>;

export default (): Config => {
  return configSchema.parse({
    port: process.env.PORT,
    node_env: process.env.NODE_ENV,
    db_user: process.env.DB_USER,
    db_password: process.env.DB_PASSWORD,
    db_host: process.env.DB_HOST,
    db_port: process.env.DB_PORT,
    database_url: process.env.DATABASE_URL,
    redis_url: process.env.REDIS_URL,
    cache_ttl_ms: process.env.CACHE_TTL_MS,
    cache_detail_ttl_ms: process.env.CACHE_DETAIL_TTL_MS,
    cache_version_ttl_ms: process.env.CACHE_VERSION_TTL_MS,
  });
};
