# Step-by-Step Build Guide — CRUD & DB Modelling

This guide walks you through building this project from an empty folder to the final API. It assumes you've completed **`1.project-setup`** (NestJS + Docker + Drizzle + a single `employees` table). Here we extend that base with **real relationships**:

- **1:N** — `departments` ←→ `employees`
- **1:1** — `employees` ←→ `employee_profiles`
- **N:N** — `employees` ↔ `projects` via `employee_projects`

Every concept has a dedicated section in [README.md](./README.md) — this file is the **practical recipe**.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Recap of `1.project-setup`](#2-recap-of-1project-setup)
3. [Plan the data model](#3-plan-the-data-model)
4. [Reorganize the schema barrel](#4-reorganize-the-schema-barrel)
5. [Add the `departments` table (1:N parent)](#5-add-the-departments-table-1n-parent)
6. [Add the FK on `employees` (1:N child)](#6-add-the-fk-on-employees-1n-child)
7. [Add `employee_profiles` (1:1)](#7-add-employee_profiles-11)
8. [Add `projects` and `employee_projects` (N:N)](#8-add-projects-and-employee_projects-nn)
9. [Declare relations for the query API](#9-declare-relations-for-the-query-api)
10. [Generate & run the migration](#10-generate--run-the-migration)
11. [Build the Departments CRUD module](#11-build-the-departments-crud-module)
12. [Build the Projects CRUD module](#12-build-the-projects-crud-module)
13. [Extend Employees: profile sub-resource](#13-extend-employees-profile-sub-resource)
14. [Project members (N:N junction CRUD)](#14-project-members-nn-junction-crud)
15. [Eager-loading with `?include=`](#15-eager-loading-with-include)
16. [Update the seed script](#16-update-the-seed-script)
17. [Smoke test with `app.http`](#17-smoke-test-with-apphttp)

---

## 1. Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | ≥ 22 |
| pnpm | ≥ 9 (`corepack enable && corepack prepare pnpm@9 --activate`) |
| Docker Engine + Compose v2 | ≥ 20.10 |
| VS Code + REST Client extension | for `app.http` |

Bring up the database before running any `pnpm db:*` command:

```bash
./scripts/docker.sh db:up
```

---

## 2. Recap of `1.project-setup`

You already have:

- A NestJS 11 app booted from `src/main.ts`
- `ConfigModule` loading `.env.${NODE_ENV}[.local]`
- A Dockerfile + `docker-compose.yml` (api + postgres) and `scripts/docker.sh`
- A global `DatabaseModule` providing a `DRIZZLE` token
- `drizzle.config.ts` pointing at `src/database/schema.ts`
- A single `employees` table with full CRUD, zod validation, pagination, and a seeder

Everything below builds on those foundations.

---

## 3. Plan the data model

```
┌────────────┐      1   ┌────────────┐   1   ┌──────────────────┐
│ departments│──────────│ employees  │───────│ employee_profiles│
└────────────┘   N      └────────────┘       └──────────────────┘
                              │ N
                              │
                              │ via
                        ┌─────▼──────────┐
                        │employee_projects│  (composite PK)
                        └─────▲──────────┘
                              │ N
                              │
                          ┌───┴────┐
                          │projects│
                          └────────┘
```

| Relationship | Where the FK lives | Cardinality enforced by |
| --- | --- | --- |
| 1:N (`departments` → `employees`) | `employees.department_id` | nothing extra — multiple rows allowed |
| 1:1 (`employees` → `employee_profiles`) | `employee_profiles.employee_id` is **PK + FK** | `PRIMARY KEY` doubles as a `UNIQUE` |
| N:N (`employees` ↔ `projects`) | `employee_projects.{employee_id, project_id}` | composite `PRIMARY KEY` on the pair |

---

## 4. Reorganize the schema barrel

Each feature owns its own table file under `src/<feature>/schema/`. The single barrel `src/database/schema.ts` re-exports them so both the runtime client and `drizzle-kit` see one namespace.

```ts
// src/database/schema.ts
export * from '../departments/schema/department.schema';
export * from '../employees/schema/employee.schema';
export * from '../employees/schema/employee-profile.schema';
export * from '../projects/schema/project.schema';
export * from '../projects/schema/employee-project.schema';
export * from './relations';
```

> The `relations` re-export at the bottom is what hooks the relational query API into `db.query.<table>`.

---

## 5. Add the `departments` table (1:N parent)

```ts
// src/departments/schema/department.schema.ts
import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type DepartmentRow = typeof departments.$inferSelect;
export type NewDepartmentRow = typeof departments.$inferInsert;
```

The parent of a 1:N has no extra columns — the FK lives on the child.

---

## 6. Add the FK on `employees` (1:N child)

In `1.project-setup`, `employees.department` was a free-form `varchar`. Replace it with a real FK:

```ts
// src/employees/schema/employee.schema.ts (delta)
import { departments } from '../../departments/schema/department.schema';
import { index } from 'drizzle-orm/pg-core';

export const employees = pgTable(
  'employees',
  {
    // ...existing columns...
    departmentId: uuid('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('employees_department_id_idx').on(t.departmentId)],
);
```

Two design choices worth understanding (see [README §3](./README.md#3-foreign-keys--cascade-rules)):

1. **Nullable FK** — employees can exist without a department.
2. **`onDelete: 'set null'`** — deleting a department keeps its employees but clears their FK. The alternatives are `'cascade'` (delete employees too) and `'restrict'` (block the delete).

The explicit index speeds up `WHERE department_id = $1` lookups.

---

## 7. Add `employee_profiles` (1:1)

```ts
// src/employees/schema/employee-profile.schema.ts
export const employeeProfiles = pgTable('employee_profiles', {
  employeeId: uuid('employee_id')
    .primaryKey()                                     // ← unique by virtue of being PK
    .references(() => employees.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  phone: varchar('phone', { length: 30 }),
  address: text('address'),
  dateOfBirth: date('date_of_birth'),
  // timestamps...
});
```

The 1:1 trick: the FK column **is** the primary key. Postgres enforces uniqueness for free, no separate `unique()` needed. `onDelete: 'cascade'` removes the profile if the employee is deleted.

---

## 8. Add `projects` and `employee_projects` (N:N)

`projects` is a normal table:

```ts
// src/projects/schema/project.schema.ts
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull().unique(),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  // timestamps...
});
```

The **junction** carries the relationship plus per-link metadata:

```ts
// src/projects/schema/employee-project.schema.ts
export const employeeProjects = pgTable(
  'employee_projects',
  {
    employeeId: uuid('employee_id').notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 100 }).notNull(),
    allocation: integer('allocation').notNull().default(100),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.projectId] })],
);
```

Why these choices?

- **Composite PK** prevents the same employee being assigned twice to the same project — without an extra index.
- **Both FKs cascade** so the junction is cleaned up when either parent is deleted.
- **`role` and `allocation`** are the textbook reason this is a real table, not a hidden array.

---

## 9. Declare relations for the query API

Foreign keys give you SQL integrity. To use Drizzle's `db.query.employees.findMany({ with: { ... } })`, you declare relations in TypeScript:

```ts
// src/database/relations.ts
import { relations } from 'drizzle-orm';

export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  profile: one(employeeProfiles, {
    fields: [employees.id],
    references: [employeeProfiles.employeeId],
  }),
  projects: many(employeeProjects),
}));

export const employeeProfilesRelations = relations(employeeProfiles, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeProfiles.employeeId],
    references: [employees.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(employeeProjects),
}));

export const employeeProjectsRelations = relations(employeeProjects, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeProjects.employeeId],
    references: [employees.id],
  }),
  project: one(projects, {
    fields: [employeeProjects.projectId],
    references: [projects.id],
  }),
}));
```

Patterns to remember:

- **1:N** — `many()` on the parent, `one()` on the child.
- **1:1** — `one()` on **both** sides; Drizzle treats it as a 1:N where the FK is unique.
- **N:N** — both ends declare `many(<junction>)`. To reach the other side in queries, **nest** the `with`:
  ```ts
  with: { projects: { with: { project: true } } }
  ```

---

## 10. Generate & run the migration

```bash
pnpm db:generate    # → src/database/migrations/0001_*.sql
pnpm db:migrate     # apply to the dev DB
```

Inspect the generated SQL once — it should contain `ALTER TABLE employees ADD COLUMN department_id ...`, `CREATE TABLE departments ...`, `CREATE TABLE employee_profiles ...`, etc., plus the FK constraints with the cascade rules you chose.

> If you ever need a clean slate during development: `./scripts/docker.sh nuke && ./scripts/docker.sh up && pnpm db:migrate && pnpm db:seed`.

---

## 11. Build the Departments CRUD module

Mirror the `employees` module structure:

```
src/departments/
├── dto/
│   ├── create-department.dto.ts     # zod schema
│   ├── update-department.dto.ts     # createSchema.partial()
│   └── list-departments.dto.ts      # page/pageSize/sort/search/includeEmployees
├── schema/department.schema.ts      # already created in step 5
├── departments.controller.ts
├── departments.module.ts
└── departments.service.ts
```

Inside `departments.service.ts`:

- `create(dto)` — insert; translate Postgres `23505` to `409 Conflict` (duplicate name).
- `findAll(query)` — paginate + sort + optional `includeEmployees` via `db.query.departments.findMany({ with: { employees: true } })`.
- `findOne(id)` — same with optional eager load; `404` if missing.
- `update(id, dto)` — partial update; `404` if missing.
- `remove(id)` — delete; thanks to `onDelete: 'set null'` on `employees.department_id`, employees survive.

Register `DepartmentsModule` in `AppModule.imports`.

---

## 12. Build the Projects CRUD module

Same shape as departments, plus a **cross-field validator** in the create DTO:

```ts
export const createProjectSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
  isActive:  z.boolean().optional(),
}).strict().refine(
  (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
  { message: 'endDate must be on or after startDate', path: ['endDate'] },
);
```

`refine` is how zod expresses rules that span multiple fields. The check fires only when both dates are present.

---

## 13. Extend Employees: profile sub-resource

Two endpoints under `/employees/:id`:

| Verb | Path | Purpose |
| --- | --- | --- |
| `GET` | `/employees/:id/profile` | Read the single profile row, `404` if none. |
| `PUT` | `/employees/:id/profile` | **Upsert** — create or replace in one call. |

The PUT uses Drizzle's `onConflictDoUpdate`:

```ts
await db.insert(employeeProfiles)
  .values({ employeeId, ...dto })
  .onConflictDoUpdate({
    target: employeeProfiles.employeeId,
    set: { ...dto, updatedAt: new Date() },
  });
```

This is the idiomatic 1:1 pattern: a single statement covers "first time" and "subsequent edits".

---

## 14. Project members (N:N junction CRUD)

The junction is a real entity, so it gets its own routes — mounted under `/projects/:id`:

| Verb | Path | What it does |
| --- | --- | --- |
| `GET` | `/projects/:id/members` | List rows from `employee_projects` joined to `employees`. |
| `POST` | `/projects/:id/members` | Insert one assignment; **`23505` → 409** for duplicates. |
| `PATCH` | `/projects/:id/members/:employeeId` | Update `role` / `allocation`. |
| `DELETE` | `/projects/:id/members/:employeeId` | Remove a single assignment. |
| `GET` | `/employees/:id/projects` | The view from the other side. |

Composite PK means duplicate inserts already fail at the DB; you just need to convert that error to a 409 the same way you did for unique emails.

---

## 15. Eager-loading with `?include=`

Expose a single, predictable query parameter that turns relations on:

```
GET /employees?include=department,profile,projects
GET /employees/:id?include=department,profile,projects
GET /departments?includeEmployees=true
GET /projects/:id?includeMembers=true
```

In the service, parse `include` to a small allow-list and feed Drizzle's `with`:

```ts
const withClause = {
  ...(includes.has('department') && { department: true }),
  ...(includes.has('profile')    && { profile: true }),
  ...(includes.has('projects')   && {
    projects: { with: { project: true } },   // nest to traverse the junction
  }),
};
return db.query.employees.findMany({ with: withClause, /* ...filters */ });
```

**Always** use an allow-list — never pass raw user input into `with`. See [README §6](./README.md#6-eager-loading-vs-n1).

---

## 16. Update the seed script

Insert in dependency order so foreign keys resolve:

```
departments → employees → employee_profiles → projects → employee_projects
```

Files under `src/database/seed/`:

- `departments.seed.ts` — fixed names so other seeders can look up IDs by name.
- `employees.seed.ts` — looks up `departmentId` from the inserted departments.
- `projects.seed.ts` — also creates a few `employee_projects` rows.
- `index.ts` — orchestrates the order; supports `--reset` (TRUNCATE … RESTART IDENTITY CASCADE).

```bash
pnpm db:seed         # additive — skips conflicts on unique columns
pnpm db:seed:reset   # wipes + reseeds
```

---

## 17. Smoke test with `app.http`

1. Open [app.http](./app.http) in VS Code.
2. Start with the **Create department**, **Create employee**, and **Create project** requests; copy the returned `id`s into the `@departmentId`, `@employeeId`, and `@projectId` variables at the top of the file.
3. Walk through CRUD for each resource, then the `?include=...` requests, then the project-members section.

Expected status codes are documented inline (200, 201, 204, 400, 404, 409). If anything returns **500**, check the API logs:

```bash
docker logs --tail 50 crud-db-modelling-api
```

🎉 Done — you now have a fully relational, validated, paginated, Dockerized REST API. Read [README.md](./README.md) for the **why** behind every choice.
