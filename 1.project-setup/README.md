# Employee Management System

A production-ready REST API built with **NestJS 11**, **Drizzle ORM**, and **PostgreSQL 16**, fully containerized with Docker Compose.

> 📅 This project is the basis for the [Build a Production-Ready REST API workshop](./EVENT.md). If you're attending, follow the steps below — they're written so you can build the project from scratch alongside us.

---

## 📚 Table of Contents

- [Tech Stack](#tech-stack)
- [Final Project Structure](#final-project-structure)
- [Prerequisites](#prerequisites)
- [Step-by-Step Tutorial](#step-by-step-tutorial)
  - [Step 1 — Scaffold the NestJS project](#step-1--scaffold-the-nestjs-project)
  - [Step 2 — Configure TypeScript & cleanup](#step-2--configure-typescript--cleanup)
  - [Step 3 — Add environment files](#step-3--add-environment-files)
  - [Step 4 — Wire up `@nestjs/config`](#step-4--wire-up-nestjsconfig)
  - [Step 5 — Dockerize the API](#step-5--dockerize-the-api)
  - [Step 6 — Compose: API + PostgreSQL](#step-6--compose-api--postgresql)
  - [Step 7 — Auto-create databases on first boot](#step-7--auto-create-databases-on-first-boot)
  - [Step 8 — Add the `docker.sh` helper](#step-8--add-the-dockersh-helper)
  - [Step 9 — Install Drizzle ORM](#step-9--install-drizzle-orm)
  - [Step 10 — Define the database module](#step-10--define-the-database-module)
  - [Step 11 — Configure Drizzle Kit](#step-11--configure-drizzle-kit)
  - [Step 12 — Define the employees schema](#step-12--define-the-employees-schema)
  - [Step 13 — Generate & run migrations](#step-13--generate--run-migrations)
  - [Step 14 — Add zod validation utilities](#step-14--add-zod-validation-utilities)
  - [Step 15 — Build the Employees CRUD module](#step-15--build-the-employees-crud-module)
  - [Step 16 — Pagination, sorting, filtering](#step-16--pagination-sorting-filtering)
  - [Step 17 — Handle DB errors as proper HTTP responses](#step-17--handle-db-errors-as-proper-http-responses)
  - [Step 18 — Seed the database](#step-18--seed-the-database)
  - [Step 19 — Test with the REST Client](#step-19--test-with-the-rest-client)
- [Daily Workflow](#daily-workflow)
- [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **NestJS 11** (TypeScript) | Opinionated, modular, DI-first |
| ORM | **Drizzle 0.45** + drizzle-kit | Type-safe, schema-first, no decorators |
| DB driver | **node-postgres (`pg`)** | Battle-tested, widely supported |
| Database | **PostgreSQL 16** (alpine) | Reliable open-source RDBMS |
| Validation | **zod 4** | Runtime + compile-time type safety |
| Config | **`@nestjs/config`** + **dotenv** | Per-env file loading |
| Package mgr | **pnpm 9** (via corepack) | Fast, deterministic |
| Container | **Docker** + **Compose v2** | Reproducible local stack |

---

## Final Project Structure

```
employee-management-system/
├── docker/
│   └── postgres/
│       └── init-databases.sh        # creates dev & prod DBs on first start
├── scripts/
│   ├── docker.sh                    # convenience wrapper for compose
│   └── Readme.md
├── src/
│   ├── common/
│   │   ├── decorators/zod.decorators.ts
│   │   └── pipes/zod-validation.pipe.ts
│   ├── config/
│   │   └── index.ts
│   ├── database/
│   │   ├── migrations/              # generated SQL (drizzle-kit)
│   │   ├── seed/
│   │   │   ├── employees.seed.ts
│   │   │   └── index.ts
│   │   ├── database.constants.ts
│   │   ├── database.module.ts
│   │   └── schema.ts                # barrel for drizzle schemas
│   ├── employees/
│   │   ├── dto/
│   │   │   ├── create-employee.dto.ts
│   │   │   ├── list-employees.dto.ts
│   │   │   └── update-employee.dto.ts
│   │   ├── schema/employee.schema.ts
│   │   ├── employees.controller.ts
│   │   ├── employees.module.ts
│   │   └── employees.service.ts
│   ├── app.module.ts
│   └── main.ts
├── .env.development
├── .env.production
├── .env.example
├── app.http
├── docker-compose.yml
├── dockerfile
├── drizzle.config.ts
├── package.json
└── README.md
```

---

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | ≥ 22 |
| pnpm | ≥ 9 (`corepack enable && corepack prepare pnpm@9 --activate`) |
| Docker Engine + Compose v2 | ≥ 20.10 |
| Git | latest |

---

## Step-by-Step Tutorial

> Run every command from inside the project folder unless specified otherwise.

### Step 1 — Scaffold the NestJS project

```bash
# Install the Nest CLI globally (one-time)
pnpm add -g @nestjs/cli

# Create the project (pick `pnpm` when prompted)
nest new employee-management-system
cd employee-management-system
```

This gives you the default `src/{app.module,app.controller,app.service,main}.ts` files.

### Step 2 — Configure TypeScript & cleanup

Open [tsconfig.json](./tsconfig.json) and ensure the following are set:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "target": "ES2023",
    "module": "commonjs",
    "outDir": "./dist"
  }
}
```

Delete `app.controller.ts`, `app.service.ts`, and the related `.spec.ts` files — we'll build a real controller next.

### Step 3 — Add environment files

Create three files at the project root:

**`.env.example`** (commit this)
```dotenv
PORT=8000
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=employee_db_developement
DB_PORT_HOST=5432
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/employee_db_developement
```

**`.env.development`** — same shape (used inside Docker; host = `postgres`).

**`.env.production`** — same shape but `DB_NAME=employee_db_production`.

Add to `.gitignore`:

```gitignore
.env
.env.local
.env.development.local
.env.production.local
```

### Step 4 — Wire up `@nestjs/config`

```bash
pnpm add @nestjs/config zod
```

Replace [src/app.module.ts](./src/app.module.ts) with:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

const NODE_ENV = process.env.NODE_ENV ?? 'development';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Most-specific first wins
      envFilePath: [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env'],
    }),
  ],
})
export class AppModule {}
```

Update [src/main.ts](./src/main.ts) to read `PORT` from config and enable shutdown hooks:

```ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = app.get(ConfigService).get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`▶ API listening on :${port}`);
}
bootstrap();
```

### Step 5 — Dockerize the API

Create a multi-stage [dockerfile](./dockerfile):

```dockerfile
# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . ./
RUN pnpm build

# ── Stage 2: Production ────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 8000
CMD ["node", "dist/main"]
```

And a [.dockerignore](./.dockerignore):

```
node_modules
dist
.git
.env
.env.*.local
```

### Step 6 — Compose: API + PostgreSQL

Create [docker-compose.yml](./docker-compose.yml):

```yaml
services:
  api:
    build: { context: ., dockerfile: dockerfile }
    container_name: employee-management-api
    ports: ["${PORT:-8000}:8000"]
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 8000
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-employee_db_developement}
    depends_on:
      postgres: { condition: service_healthy }
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: employee-management-postgres
    ports: ["${DB_PORT_HOST:-5432}:5432"]
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-employee_db_developement}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init-databases.sh:/docker-entrypoint-initdb.d/10-init-databases.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### Step 7 — Auto-create databases on first boot

Create [docker/postgres/init-databases.sh](./docker/postgres/init-databases.sh):

```bash
#!/usr/bin/env bash
set -euo pipefail

DBS=("employee_db_developement" "employee_db_production")

for db in "${DBS[@]}"; do
  echo "▶ Ensuring database '${db}' exists"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE "${db}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
EOSQL
done
```

Make it executable:

```bash
chmod +x docker/postgres/init-databases.sh
```

> ⚠️ This script only runs **once** — when the postgres data volume is empty. To re-trigger it, run `./scripts/docker.sh nuke` (after step 8).

### Step 8 — Add the `docker.sh` helper

Create [scripts/docker.sh](./scripts/docker.sh) with commands like `up`, `down`, `psql`, `nuke`, etc. (See the file in this repo for the full script.) Then:

```bash
chmod +x scripts/docker.sh
./scripts/docker.sh up
```

You should now see:

```
✔ Container employee-management-postgres   Healthy
✔ Container employee-management-api        Started
```

### Step 9 — Install Drizzle ORM

```bash
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg
```

### Step 10 — Define the database module

Create [src/database/database.constants.ts](./src/database/database.constants.ts):

```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE_CLIENT');
export type DrizzleDB = NodePgDatabase<typeof schema>;
```

Create [src/database/schema.ts](./src/database/schema.ts) (barrel — populated in step 12):

```ts
export * from '../employees/schema/employee.schema';
```

Create [src/database/database.module.ts](./src/database/database.module.ts):

```ts
import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE } from './database.constants';
import * as schema from './schema';

const POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new Pool({ connectionString: cfg.getOrThrow<string>('DATABASE_URL') }),
    },
    {
      provide: DRIZZLE,
      inject: [POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(/* inject pool here if you want explicit close */) {}
  async onApplicationShutdown() {
    /* pool.end() — see repo for full impl */
  }
}
```

Add `DatabaseModule` to `AppModule.imports`.

### Step 11 — Configure Drizzle Kit

```bash
pnpm add -D dotenv
```

Create [drizzle.config.ts](./drizzle.config.ts) at the project root:

```ts
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { defineConfig } from 'drizzle-kit';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
loadEnv({ path: join(__dirname, `.env.${NODE_ENV}.local`), override: false });
loadEnv({ path: join(__dirname, `.env.${NODE_ENV}`), override: false });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
```

Exclude this file from the Nest build in [tsconfig.build.json](./tsconfig.build.json):

```jsonc
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "drizzle.config.ts", "**/*spec.ts"]
}
```

> Because drizzle-kit runs on your **host**, create a gitignored `.env.development.local` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/employee_db_developement` so it can reach the container's published port.

### Step 12 — Define the employees schema

Create [src/employees/schema/employee.schema.ts](./src/employees/schema/employee.schema.ts):

```ts
import {
  boolean, pgTable, text, timestamp, uuid, varchar,
} from 'drizzle-orm/pg-core';

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  position: varchar('position', { length: 100 }).notNull(),
  department: varchar('department', { length: 100 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeRow = typeof employees.$inferSelect;
export type NewEmployeeRow = typeof employees.$inferInsert;
```

### Step 13 — Generate & run migrations

Add scripts to [package.json](./package.json):

```jsonc
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:push":     "drizzle-kit push",
"db:studio":   "drizzle-kit studio"
```

Then:

```bash
pnpm db:generate     # produces src/database/migrations/0000_*.sql
pnpm db:migrate      # applies them to the dev DB
```

### Step 14 — Add zod validation utilities

Create [src/common/pipes/zod-validation.pipe.ts](./src/common/pipes/zod-validation.pipe.ts):

```ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: r.error.issues,
      });
    }
    return r.data;
  }
}
```

And reusable decorators in [src/common/decorators/zod.decorators.ts](./src/common/decorators/zod.decorators.ts):

```ts
import { Body, Param, Query } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ZodBody  = (s: ZodTypeAny) => Body(new ZodValidationPipe(s));
export const ZodQuery = (s: ZodTypeAny) => Query(new ZodValidationPipe(s));
export const ZodParam = (k: string, s: ZodTypeAny) =>
  Param(k, new ZodValidationPipe(s));
```

### Step 15 — Build the Employees CRUD module

Create the DTO files:

**`create-employee.dto.ts`**
```ts
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email:     z.string().email().max(255),
  position:  z.string().min(1).max(100),
  department: z.string().max(100).optional(),
  notes:      z.string().optional(),
  isActive:   z.boolean().optional(),
}).strict();

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
```

**`update-employee.dto.ts`**
```ts
import { createEmployeeSchema } from './create-employee.dto';
import { z } from 'zod';

export const updateEmployeeSchema = createEmployeeSchema.partial();
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
```

Then create the service, module and controller (see the files in `src/employees/` for the full implementations). Wire `EmployeesModule` into `AppModule`.

### Step 16 — Pagination, sorting, filtering

**`list-employees.dto.ts`**
```ts
import { z } from 'zod';

export const employeeSortFields = z.enum([
  'firstName', 'lastName', 'email', 'department', 'createdAt', 'updatedAt',
]);

export const listEmployeesSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy:   employeeSortFields.default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search:     z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  position:   z.string().trim().min(1).optional(),
  isActive:   z.coerce.boolean().optional(),
});

export type ListEmployeesDto = z.infer<typeof listEmployeesSchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
```

In the service's `findAll`, build `WHERE` with `and(...filters)`, run the rows query and a `count(*)` in parallel via `Promise.all`, then return `{ data, meta }`.

### Step 17 — Handle DB errors as proper HTTP responses

In `EmployeesService.create` (and `update`), catch the unique-violation error and translate it:

```ts
const PG_UNIQUE_VIOLATION = '23505';

private isUniqueViolation(err: unknown): boolean {
  const hasCode = (e: unknown): e is { code?: string } =>
    typeof e === 'object' && e !== null && 'code' in e;
  if (hasCode(err) && err.code === PG_UNIQUE_VIOLATION) return true;
  // drizzle wraps the underlying pg error on `.cause`
  if (
    typeof err === 'object' && err !== null && 'cause' in err &&
    hasCode((err as { cause?: unknown }).cause) &&
    (err as { cause: { code?: string } }).cause.code === PG_UNIQUE_VIOLATION
  ) return true;
  return false;
}
```

Now duplicate-email POSTs return a clean **`409 Conflict`** instead of a 500.

### Step 18 — Seed the database

Create [src/database/seed/employees.seed.ts](./src/database/seed/employees.seed.ts) with sample rows, and [src/database/seed/index.ts](./src/database/seed/index.ts) to insert them. Add scripts:

```jsonc
"db:seed":       "ts-node -r tsconfig-paths/register --transpile-only src/database/seed/index.ts",
"db:seed:reset": "ts-node -r tsconfig-paths/register --transpile-only src/database/seed/index.ts --reset"
```

Run:

```bash
pnpm db:seed         # additive (skips emails that already exist)
pnpm db:seed:reset   # TRUNCATE first
```

### Step 19 — Test with the REST Client

Open [app.http](./app.http) in VS Code (with the **REST Client** extension installed) and click **Send Request** above any block. The file covers create / list / read / update / delete plus error cases (400, 404, 409).

🎉 **You're done.** You have a fully working, validated, paginated, Dockerized REST API.

---

## Daily Workflow

```bash
# Bring up the full stack (api + postgres)
./scripts/docker.sh up

# Tail logs
./scripts/docker.sh logs

# Open psql against the active env's database
./scripts/docker.sh psql

# Run a one-off command in the api container
./scripts/docker.sh sh

# Rebuild after Dockerfile / dependency changes
./scripts/docker.sh rebuild

# Switch to production stack
./scripts/docker.sh up production

# Wipe everything (asks for confirmation, deletes the postgres volume)
./scripts/docker.sh nuke
```

For host-side scripts (`pnpm start:dev`, `pnpm db:*`, `pnpm db:seed`):

```bash
# Postgres only — leaves you free to run the API on the host with hot reload
./scripts/docker.sh db:up
pnpm start:dev
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :::8000` | The api container already owns port 8000. Run `./scripts/docker.sh down` (or change `PORT`). |
| `getaddrinfo EAI_AGAIN postgres` | You're running a host script with the in-container `DATABASE_URL`. Create `.env.development.local` with `host=localhost`. |
| `database "..." does not exist` | The init script only runs on a **fresh** volume. Run `./scripts/docker.sh nuke && ./scripts/docker.sh up`. |
| `500 Internal Server Error` on duplicate email | You skipped Step 17 — drizzle wraps pg errors on `.cause`. |
| ADS / pgAdmin: `Temporary failure in name resolution` | Use `localhost`, not `postgres`, when connecting from your host machine. |

---

Made with ❤️ for the Kenya Data Platform User Group community.
