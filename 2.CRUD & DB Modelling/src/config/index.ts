import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  node_env: z.enum(['development', 'production']).default('development'),
  db_user: z.string().min(1).default('postgres'),
  db_password: z.string().min(1).default('postgres'),
  db_host: z.string().min(1).default('localhost'),
  db_port: z.coerce.number().int().positive().default(5432),
  database_url: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5432/employee_db'),
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
  });
};
