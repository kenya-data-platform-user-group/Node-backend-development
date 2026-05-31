/**
 * Injection token for the Drizzle client. Use with `@Inject(DRIZZLE)`.
 *
 *   constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}
 */
export const DRIZZLE = Symbol('DRIZZLE_CLIENT');

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export type DrizzleDB = NodePgDatabase<typeof schema>;
