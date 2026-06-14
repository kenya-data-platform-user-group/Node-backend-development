import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path/win32';
import config from './config';
import { DatabaseModule } from './database/database.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envDir = join(__dirname, '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [config],
      envFilePath: [
        join(envDir, `.env.${NODE_ENV}.local`),
        join(envDir, `.env.${NODE_ENV}`),
        join(envDir, '.env'),
      ],
    }),
    DatabaseModule,
    RemindersModule,
    SchedulingModule,
  ],
})
export class AppModule {}
