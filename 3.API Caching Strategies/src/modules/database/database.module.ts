import {
  Global,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Config } from '../../config';
import { DRIZZLE, type DrizzleDB } from './database.constants';
import * as schema from './schema';

const POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config, true>) => {
        const connectionString = configService.get('database_url', {
          infer: true,
        });
        return new Pool({ connectionString });
      },
    },
    {
      provide: DRIZZLE,
      inject: [POOL],
      useFactory: (pool: Pool): DrizzleDB => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const pool = this.moduleRef.get<Pool>(POOL, { strict: false });
    if (pool) {
      this.logger.log('Closing PostgreSQL connection pool');
      await pool.end();
    }
  }
}
