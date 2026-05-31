import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import config from './config';
import { DatabaseModule } from './modules/database/database.module';
import type { Config } from './config';
import { EventsModule } from './modules/events/events.module';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const cacheLogger = new Logger('CacheModule');

// Resolve env files relative to the package root, working for both
// `ts-node` (src/) and compiled (dist/) runtimes.
const envDir = join(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [config],
      // Most-specific first — the first file to define a variable wins.
      envFilePath: [
        join(envDir, `.env.${NODE_ENV}.local`),
        join(envDir, `.env.${NODE_ENV}`),
        join(envDir, '.env'),
      ],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config, true>) => {
        const keyv = createKeyv(
          configService.get('redis_url', { infer: true }),
          {
            namespace: 'event-api-cache',
          },
        );

        keyv.on('error', (error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown Redis cache error';
          cacheLogger.error(message);
        });

        return {
          ttl: configService.get('cache_ttl_ms', { infer: true }),
          stores: [keyv],
        };
      },
    }),
    DatabaseModule,
    EventsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
