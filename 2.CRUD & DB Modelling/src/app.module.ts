import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import config from './config';
import { DatabaseModule } from './database/database.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ProjectsModule } from './modules/projects/projects.module';

const NODE_ENV = process.env.NODE_ENV ?? 'development';

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
    DatabaseModule,
    DepartmentsModule,
    EmployeesModule,
    ProjectsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
