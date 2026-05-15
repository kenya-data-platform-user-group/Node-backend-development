import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(3000),
  node_env: z.enum(['development', 'production']).default('development'),
  db_user: z.string().default('postgres'),
  db_password: z.string().default('postgres'),
  db_host: z.string().default('localhost'),
  db_port: z.number().default(5432),
  database_url: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/employee_db'),
});

export type Config = z.infer<typeof configSchema>;

export default (): Config => {
  const nodeEnv = process.env.NODE_ENV as
    | 'development'
    | 'production'
    | undefined;
  const envConfig = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    node_env: nodeEnv,
    db_user: process.env.DB_USER,
    db_password: process.env.DB_PASSWORD,
    db_host: process.env.DB_HOST,
    db_port: process.env.DB_PORT
      ? parseInt(process.env.DB_PORT, 10)
      : undefined,
    database_url: process.env.DATABASE_URL,
  };
  return configSchema.parse(envConfig);
};
