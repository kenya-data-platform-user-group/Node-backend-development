import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  node_env: z.enum(['development', 'production']).default('development'),
  database_url: z.string().default('mongodb://localhost:27017'),
  database_name: z.string().default('reminders'),
});

export type Config = z.infer<typeof configSchema>;

export default (): Config => {
  return configSchema.parse({
    port: process.env.PORT,
    node_env: process.env.NODE_ENV,
    database_url: process.env.DATABASE_URL,
    database_name: process.env.DATABASE_NAME,
  });
};
