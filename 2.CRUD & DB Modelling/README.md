# 2 — CRUD & DB Modelling

A relational REST API built with **NestJS 11**, **Drizzle ORM 0.45**, **PostgreSQL 16**, and **zod 4**, fully containerized. Continues from `1.project-setup` and adds the three relationship cardinalities every backend dev needs to be fluent in: **1:N**, **1:1**, **N:N**.

> 📘 For the practical, command-by-command build instructions, see [step-by-step.md](./step-by-step.md). This README is the **conceptual reference** — every section explains the *why* behind a piece of the codebase.

---

## Table of Contents

1. [What this project covers](#1-what-this-project-covers)
2. [The data model at a glance](#2-the-data-model-at-a-glance)
3. [Foreign keys & cascade rules](#3-foreign-keys--cascade-rules)
4. [Modelling cardinalities in Drizzle](#4-modelling-cardinalities-in-drizzle)
   - [1:N — `departments` ⇄ `employees`](#41-1n--departments--employees)
   - [1:1 — `employees` ⇄ `employee_profiles`](#42-11--employees--employee_profiles)
   - [N:N — `employees` ⇄ `projects` via `employee_projects`](#43-nn--employees--projects-via-employee_projects)
5. [The Drizzle relational query API](#5-the-drizzle-relational-query-api)
6. [Eager loading vs. N+1](#6-eager-loading-vs-n1)
7. [REST design for related resources](#7-rest-design-for-related-resources)
8. [Validation with zod](#8-validation-with-zod)
9. [Pagination, sorting, filtering](#9-pagination-sorting-filtering)
10. [Mapping database errors to HTTP responses](#10-mapping-database-errors-to-http-responses)
11. [Migrations & seed strategy](#11-migrations--seed-strategy)
12. [Project structure](#12-project-structure)
13. [Daily workflow](#13-daily-workflow)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What this project covers

| Topic | Where it lives | Why it matters |
| --- | --- | --- |
| Foreign keys, cascade rules | `src/**/schema/*.schema.ts` | DB-level integrity is your last line of defense. |
| 1:N modelling | `departments` ⇄ `employees` | The most common shape in business data. |
| 1:1 modelling | `employees` ⇄ `employee_profiles` | How to split optional/heavy columns into a sibling table. |
| N:N modelling + junction with metadata | `employees` ↔ `projects` via `employee_projects` | Real-world links carry their own attributes (`role`, `allocation`). |
| Drizzle relational queries (`db.query.*`) | `src/database/relations.ts` | Type-safe, no string SQL, no decorators. |
| Eager loading via `?include=...` | `*.controller.ts` + `*.service.ts` | Solves N+1 without leaking the ORM to clients. |
| zod validation + cross-field rules | `src/**/dto/*.ts` | Runtime safety + free TS types. |
| Pagination / sorting / filtering | `list-*.dto.ts`, `*.service.ts` | Standard contract for any list endpoint. |
| Translating DB errors to HTTP | `*.service.ts` | No more `500` on a duplicate email. |
| Seed orchestration with FKs | `src/database/seed/index.ts` | Insert order matters when relationships exist. |

---

## 2. The data model at a glance

```
┌────────────┐        ┌────────────┐  1:1  ┌──────────────────┐
│ departments│ 1    N │ employees  │───────│ employee_profiles│
│ (parent)   │────────│            │       │  PK = FK         │
└────────────┘        └────────────┘       └──────────────────┘
                            │ N
                            │
                       N:N  │ via
                       ┌────▼─────────────┐
                       │ employee_projects│  PK = (employee_id, project_id)
                       │ + role, allocation│
                       └────▲─────────────┘
                            │ N
                       ┌────┴────┐
                       │ projects│
                       └─────────┘
```

| Table | Purpose | Key columns |
| --- | --- | --- |
| `departments` | Parent of a 1:N | `id (PK, uuid)`, `name (unique)` |
| `employees` | Central entity | `id (PK)`, `email (unique)`, `department_id (FK, nullable)` |
| `employee_profiles` | 1:1 sibling, optional | `employee_id (PK + FK)` |
| `projects` | One side of an N:N | `id (PK)`, `name (unique)` |
| `employee_projects` | Junction with metadata | composite PK `(employee_id, project_id)`, `role`, `allocation` |

---

## 📐 Detailed Architecture Diagrams

### 1. Database Schema with Relationships

```
┌───────────────────────────────────────────────────────┐
│                    departments                        │
├───────────────────────────────────────────────────────┤
│ id              UUID (PK)                             │
│ name            VARCHAR(255) UNIQUE NOT NULL          │
│ description     TEXT                                  │
│ created_at      TIMESTAMP DEFAULT NOW()               │
│ updated_at      TIMESTAMP DEFAULT NOW()               │
└─────────────┬─────────────────────────────────────────┘
              │
              │ 1:N (One department, Many employees)
              │ FK: employees.department_id
              │ ON DELETE: SET NULL
              ▼
┌───────────────────────────────────────────────────────┐
│                     employees                         │
├───────────────────────────────────────────────────────┤
│ id              SERIAL (PK)                           │
│ email           VARCHAR(255) UNIQUE NOT NULL          │
│ first_name      VARCHAR(100) NOT NULL                 │
│ last_name       VARCHAR(100) NOT NULL                 │
│ hire_date       DATE NOT NULL                         │
│ department_id   UUID (FK → departments.id, nullable)  │
│ created_at      TIMESTAMP DEFAULT NOW()               │
│ updated_at      TIMESTAMP DEFAULT NOW()               │
└─────┬─────────────────────────────────┬───────────────┘
      │                                 │
      │ 1:1 (One employee,              │ N:N (Many employees,
      │      One profile)               │      Many projects)
      │                                 │
      ▼                                 ▼
┌───────────────────────────┐  ┌──────────────────────────┐
│   employee_profiles       │  │   employee_projects      │
├───────────────────────────┤  ├──────────────────────────┤
│ employee_id  INT (PK+FK)  │  │ employee_id  INT (FK) ─┐ │
│ bio          TEXT         │  │ project_id   INT (FK) ─┼─┤ Composite PK
│ avatar_url   VARCHAR      │  │ role         VARCHAR  ─┘ │
│ phone        VARCHAR      │  │ allocation   INT (%)     │
│ address      TEXT         │  │ joined_at    TIMESTAMP   │
│ created_at   TIMESTAMP    │  └─────┬────────────────────┘
│ updated_at   TIMESTAMP    │        │
└───────────────────────────┘        │ N:N
                                     │
                                     ▼
                           ┌──────────────────────┐
                           │      projects        │
                           ├──────────────────────┤
                           │ id       SERIAL (PK) │
                           │ name     VARCHAR     │
                           │ budget   DECIMAL     │
                           │ status   VARCHAR     │
                           └──────────────────────┘

Cascade Rules:
• Department deleted → employee.department_id = NULL (SET NULL)
• Employee deleted → profile deleted (CASCADE)
• Employee deleted → assignments deleted (CASCADE)
• Project deleted → assignments deleted (CASCADE)
```

### 2. 1:N Relationship (Department → Employees)

```
One Department, Many Employees

┌────────────────────────────────┐
│       departments              │
│  ┌──────────────────────────┐  │
│  │ id: "dept-123"           │  │
│  │ name: "Engineering"      │  │
│  └──────────────────────────┘  │
└──────────────┬─────────────────┘
               │
               │ Has Many (1:N)
               │
    ┌──────────┴──────────┬──────────────┬──────────────┐
    │                     │              │              │
    ▼                     ▼              ▼              ▼
┌───────────┐     ┌───────────┐  ┌───────────┐  ┌───────────┐
│ Employee  │     │ Employee  │  │ Employee  │  │ Employee  │
│    #1     │     │    #2     │  │    #3     │  │    #4     │
├───────────┤     ├───────────┤  ├───────────┤  ├───────────┤
│ id: 101   │     │ id: 102   │  │ id: 103   │  │ id: 104   │
│ dept_id:  │     │ dept_id:  │  │ dept_id:  │  │ dept_id:  │
│ "dept-123"│     │ "dept-123"│  │ "dept-123"│  │ "dept-123"│
│ name:     │     │ name:     │  │ name:     │  │ name:     │
│ "Alice"   │     │ "Bob"     │  │ "Carol"   │  │ "Dave"    │
└───────────┘     └───────────┘  └───────────┘  └───────────┘

Query Examples:

1. Get department with all employees (Eager Loading):
   GET /departments/dept-123?include=employees

   SELECT departments.*, employees.*
   FROM departments
   LEFT JOIN employees ON employees.department_id = departments.id
   WHERE departments.id = 'dept-123'

2. Get employee with department (Reverse):
   GET /employees/101?include=department

   SELECT employees.*, departments.*
   FROM employees
   LEFT JOIN departments ON departments.id = employees.department_id
   WHERE employees.id = 101

Cascade Behavior:

DELETE FROM departments WHERE id = 'dept-123'
↓
ON DELETE SET NULL
↓
UPDATE employees
SET department_id = NULL
WHERE department_id = 'dept-123'
↓
Result: Employees 101-104 now have department_id = NULL
```

### 3. 1:1 Relationship (Employee → Profile)

```
One Employee, One Profile (Optional)

┌──────────────────────────────┐
│        employees             │
│  ┌────────────────────────┐  │
│  │ id: 101                │  │
│  │ email: "alice@..."     │  │
│  │ first_name: "Alice"    │  │
│  │ last_name: "Smith"     │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │
               │ 1:1 (One-to-One)
               │ PK = FK
               ▼
┌──────────────────────────────┐
│     employee_profiles        │
│  ┌────────────────────────┐  │
│  │ employee_id: 101 (PK)  │  │ ← Primary Key = Foreign Key
│  │ bio: "Software..."     │  │
│  │ avatar_url: "..."      │  │
│  │ phone: "+1..."         │  │
│  │ address: "123..."      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘

Why 1:1?
✅ Optional data (not all employees have profiles)
✅ Large/heavy columns (bio, address, avatar)
✅ Different access patterns (main data vs extended)
✅ Separation of concerns (core vs optional)

Implementation:
• employee_id is BOTH Primary Key AND Foreign Key
• Profile can only exist if employee exists
• One employee can have at most one profile

Query Examples:

1. Get employee with profile:
   GET /employees/101?include=profile

   SELECT employees.*, employee_profiles.*
   FROM employees
   LEFT JOIN employee_profiles
     ON employee_profiles.employee_id = employees.id
   WHERE employees.id = 101

Cascade Behavior:

DELETE FROM employees WHERE id = 101
↓
ON DELETE CASCADE
↓
DELETE FROM employee_profiles WHERE employee_id = 101
↓
Result: Profile automatically deleted (can't exist without employee)
```

### 4. N:N Relationship (Employees ↔ Projects)

```
Many Employees, Many Projects (Junction Table)

┌──────────────────┐                           ┌──────────────────┐
│   Employee 1     │                           │   Project A      │
│   "Alice"        │                           │   "Website"      │
└────────┬─────────┘                           └────────┬─────────┘
         │                                              │
         │                                              │
         │  ┌───────────────────────────────────────┐   │
         │  │    employee_projects                  │   │
         └─▶│    (Junction Table)                   │◀──┘
            │                                       │
            │  ┌─────────────────────────────────┐  │
            │  │ employee_id: 1                  │  │
            │  │ project_id: A                   │  │
            │  │ role: "Backend Dev"             │  │ ← Metadata!
            │  │ allocation: 50%                 │  │
            │  └─────────────────────────────────┘  │
            └───────────────────────────────────────┘

Full Example with Multiple Relationships:

Employees:                  Junction (Assignments):              Projects:

┌─────────────┐            ┌──────────────────────┐           ┌─────────────┐
│ Alice #1    │────┐       │ emp_id: 1, proj: A   │      ┌────│ Website A   │
└─────────────┘    │       │ role: Backend, 50%   │      │    └─────────────┘
                   ├──────▶└──────────────────────┘◀─────┤
┌─────────────┐    │       ┌──────────────────────┐      │    ┌─────────────┐
│ Bob #2      │────┼──────▶│ emp_id: 1, proj: B   │      ├────│ Mobile B    │
└─────────────┘    │       │ role: Frontend, 30%  │      │    └─────────────┘
                   │       └──────────────────────┘◀─────┤
┌─────────────┐    │       ┌──────────────────────┐      │    ┌─────────────┐
│ Carol #3    │────┘       │ emp_id: 2, proj: A   │      └────│ API C       │
└─────────────┘            │ role: Designer, 100% │           └─────────────┘
                           └──────────────────────┘◀─────┘
                           ┌──────────────────────┐
                           │ emp_id: 3, proj: B   │
                           │ role: QA, 50%        │
                           └──────────────────────┘◀─────┘
                           ┌──────────────────────┐
                           │ emp_id: 2, proj: C   │
                           │ role: Tech Lead, 80% │
                           └──────────────────────┘◀─────┘

Junction Table Schema:

┌──────────────────────────────────────────────┐
│         employee_projects                    │
├──────────────────────────────────────────────┤
│ employee_id    INT (FK → employees.id)  ─┐   │
│ project_id     INT (FK → projects.id)   ─┼─ Composite PK
│ role           VARCHAR(100)             ─┘   │
│ allocation     INT (percentage)              │
│ joined_at      TIMESTAMP                     │
└──────────────────────────────────────────────┘

Benefits of Junction with Metadata:
✅ Stores attributes of the relationship (role, allocation)
✅ Flexible querying (find all projects for an employee)
✅ Prevents duplicates (composite PK)
✅ Clean cascade on delete

Query Examples:

1. Get all projects for Alice (employee #1):
   GET /employees/1/projects

   SELECT projects.*, employee_projects.role, employee_projects.allocation
   FROM projects
   JOIN employee_projects ON employee_projects.project_id = projects.id
   WHERE employee_projects.employee_id = 1

   Result: Website (Backend, 50%), Mobile (Frontend, 30%)

2. Get all employees on Website (project A):
   GET /projects/A/employees

   SELECT employees.*, employee_projects.role, employee_projects.allocation
   FROM employees
   JOIN employee_projects ON employee_projects.employee_id = employees.id
   WHERE employee_projects.project_id = 'A'

   Result: Alice (Backend, 50%), Bob (Designer, 100%)
```

### 5. API Request Flow with Eager Loading

```
Request: GET /employees/101?include=department,profile,projects

┌────────────┐
│   Client   │
└──────┬─────┘
       │ GET /employees/101?include=department,profile,projects
       ▼
┌───────────────────────────────────────────────┐
│ Employees Controller                          │
│ @Get(':id')                                   │
│ findOne(@Param id, @Query include)            │
└──────┬────────────────────────────────────────┘
       │ Parse includes: ['department', 'profile', 'projects']
       ▼
┌───────────────────────────────────────────────┐
│ Employees Service                             │
│ findOne(id, includes)                         │
│                                               │
│ Build Drizzle query with relations:           │
│ db.query.employees.findFirst({               │
│   where: eq(employees.id, 101),              │
│   with: {                                    │
│     department: true,                        │
│     profile: true,                           │
│     employeeProjects: {                      │
│       with: { project: true }                │
│     }                                        │
│   }                                          │
│ })                                            │
└──────┬────────────────────────────────────────┘
       │ Single SQL query with JOINs
       ▼
┌───────────────────────────────────────────────┐
│           PostgreSQL                          │
│                                               │
│ SELECT                                        │
│   employees.*,                                │
│   departments.*,                              │
│   employee_profiles.*,                        │
│   employee_projects.*,                        │
│   projects.*                                  │
│ FROM employees                                │
│ LEFT JOIN departments                         │
│   ON departments.id = employees.dept_id      │
│ LEFT JOIN employee_profiles                  │
│   ON profiles.employee_id = employees.id     │
│ LEFT JOIN employee_projects                  │
│   ON ep.employee_id = employees.id           │
│ LEFT JOIN projects                            │
│   ON projects.id = ep.project_id             │
│ WHERE employees.id = 101                     │
└──────┬────────────────────────────────────────┘
       │ Returns joined data in single round-trip
       ▼
┌───────────────────────────────────────────────┐
│ Drizzle ORM (Auto-maps to objects)           │
│                                               │
│ {                                             │
│   id: 101,                                    │
│   email: "alice@example.com",                │
│   department: {                               │
│     id: "dept-123",                           │
│     name: "Engineering"                       │
│   },                                          │
│   profile: {                                  │
│     bio: "Software engineer...",             │
│     phone: "+1-555-1234"                     │
│   },                                          │
│   employeeProjects: [                         │
│     {                                         │
│       role: "Backend Dev",                   │
│       allocation: 50,                        │
│       project: {                              │
│         name: "Website Redesign"             │
│       }                                       │
│     }                                         │
│   ]                                           │
│ }                                             │
└──────┬────────────────────────────────────────┘
       │ Return formatted response
       ▼
┌────────────┐
│   Client   │ ← 200 OK with full nested data
└────────────┘

Performance:
✅ Single SQL query (no N+1 problem)
✅ Database does the joining (efficient)
✅ Type-safe at compile time (Drizzle)
✅ Flexible includes (client controls depth)

Without Eager Loading (N+1 Problem):
1 query: Get employee
1 query: Get department
1 query: Get profile
N queries: Get each project assignment
= (3 + N) queries! ❌ Slow!

With Eager Loading:
1 query: Get everything at once ✅ Fast!
```

### 6. CRUD Operations Flow

```
CREATE (POST):

Client → POST /employees
{
  "email": "alice@example.com",
  "firstName": "Alice",
  "departmentId": "dept-123"
}
  ↓
Controller: Validate with Zod
  ↓
Service: Insert into PostgreSQL
  ↓
INSERT INTO employees (email, first_name, department_id)
VALUES ('alice@...', 'Alice', 'dept-123')
RETURNING *
  ↓
Response: 201 Created
{id: 101, email: "alice@...", ...}

──────────────────────────────────

READ (GET):

Client → GET /employees?page=1&limit=10&sort=firstName
  ↓
Controller: Parse query params
  ↓
Service: Build paginated query
  ↓
SELECT * FROM employees
ORDER BY first_name ASC
LIMIT 10 OFFSET 0
  ↓
Response: 200 OK
{
  data: [{id: 101, ...}, ...],
  meta: {page: 1, total: 50}
}

──────────────────────────────────

UPDATE (PUT/PATCH):

Client → PATCH /employees/101
{
  "firstName": "Alicia",
  "departmentId": "dept-456"
}
  ↓
Controller: Validate partial update
  ↓
Service: Check if exists, then update
  ↓
UPDATE employees
SET first_name = 'Alicia',
    department_id = 'dept-456',
    updated_at = NOW()
WHERE id = 101
RETURNING *
  ↓
Response: 200 OK
{id: 101, firstName: "Alicia", ...}

──────────────────────────────────

DELETE (DELETE):

Client → DELETE /employees/101
  ↓
Controller: Validate ID
  ↓
Service: Check if exists
  ↓
DELETE FROM employees WHERE id = 101
  ↓
CASCADE: Also deletes:
  - employee_profiles (101)
  - employee_projects (employee_id = 101)
  ↓
Response: 204 No Content
```

### 7. Error Handling & Validation Flow

```
Invalid Request:

Client → POST /employees
{
  "email": "not-an-email",  ← Invalid
  "firstName": ""           ← Empty
}
  ↓
┌───────────────────────────────────┐
│ Zod Validation                    │
│                                   │
│ email: z.string().email()         │
│   → ❌ Invalid email format       │
│                                   │
│ firstName: z.string().min(1)      │
│   → ❌ String must contain at    │
│        least 1 character(s)       │
└──────┬────────────────────────────┘
       │
       ▼
┌───────────────────────────────────┐
│ 400 Bad Request                   │
│                                   │
│ {                                 │
│   "statusCode": 400,              │
│   "message": "Validation failed", │
│   "errors": {                     │
│     "email": "Invalid email",     │
│     "firstName": "Required"       │
│   }                               │
│ }                                 │
└───────────────────────────────────┘

Database Constraint Violation:

Client → POST /employees
{
  "email": "alice@example.com"  ← Already exists
}
  ↓
Zod validation passes ✓
  ↓
Try INSERT INTO employees...
  ↓
┌───────────────────────────────────┐
│ PostgreSQL Error                  │
│ Code: 23505                       │
│ Message: duplicate key value      │
│ violates unique constraint        │
│ "employees_email_unique"          │
└──────┬────────────────────────────┘
       │
       ▼
┌───────────────────────────────────┐
│ Error Handler                     │
│ (PostgresErrorService)            │
│                                   │
│ Detect: error.code === '23505'   │
│ Field: error.detail contains      │
│        "email"                    │
└──────┬────────────────────────────┘
       │
       ▼
┌───────────────────────────────────┐
│ 409 Conflict                      │
│                                   │
│ {                                 │
│   "statusCode": 409,              │
│   "message": "Email already       │
│              exists",             │
│   "field": "email"                │
│ }                                 │
└───────────────────────────────────┘
```

---

## 3. Foreign keys & cascade rules

Every FK in this project picks an explicit `onDelete` policy. The choice changes how the system behaves under deletion:

| Relationship | `onDelete` | Effect |
| --- | --- | --- |
| `employees.department_id → departments.id` | `set null` | Deleting a department keeps its employees; their FK is cleared. |
| `employee_profiles.employee_id → employees.id` | `cascade` | Deleting an employee removes the profile (it has no meaning alone). |
| `employee_projects.employee_id → employees.id` | `cascade` | Removing an employee removes their assignments. |
| `employee_projects.project_id → projects.id` | `cascade` | Removing a project removes all its assignments. |

The third option — `restrict` — refuses the delete if children exist. Pick it when losing related data is worse than failing the request.

> Always model the cascade explicitly. The default in many ORMs is "no action," which surfaces as a confusing FK violation at delete time.

---

## 4. Modelling cardinalities in Drizzle

### 4.1 1:N — `departments` ⇄ `employees`

The FK lives on the **child** (the "many" side). The parent table has no extra columns.

```ts
// child
departmentId: uuid('department_id')
  .references(() => departments.id, { onDelete: 'set null' }),
```

A nullable FK ("optional parent") models "an employee may belong to a department." A `notNull()` FK would model "an employee **must** belong to a department."

A secondary index on the FK column (`employees_department_id_idx`) is almost always worth it — listing employees by department becomes an indexed lookup instead of a scan.

### 4.2 1:1 — `employees` ⇄ `employee_profiles`

There are two common ways to enforce 1:1:

| Pattern | Pros | Cons |
| --- | --- | --- |
| **PK = FK** *(used here)* | Uniqueness for free; one row per parent guaranteed by the PK. | Child can't exist before the parent. |
| Separate PK + `unique()` on the FK | Child can have its own surrogate ID. | Extra column, extra index. |

```ts
employeeId: uuid('employee_id')
  .primaryKey()                                    // ← unique by being PK
  .references(() => employees.id, { onDelete: 'cascade' }),
```

When to split a 1:1 out at all? Two main reasons:

- **Optional, heavy columns** (long bios, avatars) you don't want to load on every employee query.
- **Sparse data** that changes ownership (auth providers, integrations).

### 4.3 N:N — `employees` ⇄ `projects` via `employee_projects`

A junction is its own table. Two design rules to internalize:

1. **Composite primary key on the FK pair**. This is what prevents duplicate links — no extra `unique()` constraint or "if exists" check needed in the service. Postgres returns `23505` if you try.
2. **The junction is the natural home for per-link attributes** (`role`, `allocation`, `assigned_at`). The moment the relationship has its own facts, it stops being "implicit" and becomes a first-class entity with its own routes.

```ts
primaryKey({ columns: [t.employeeId, t.projectId] })
```

---

## 5. The Drizzle relational query API

Foreign keys give you SQL integrity; **`relations()`** gives you type-safe traversal:

```ts
db.query.employees.findMany({
  with: {
    department: true,                              // 1:N parent → one()
    profile: true,                                 // 1:1 → one()
    projects: { with: { project: true } },         // N:N → nest through junction
  },
});
```

Two rules to remember:

- **`one()` on both sides of a 1:1** — Drizzle treats it as a 1:N where the FK is unique.
- **N:N requires nesting** — `projects: many(employeeProjects)` only reaches the junction. To get the other parent, you nest a `with` inside the junction.

Relations are **declarations**, not queries. They're inert until you use them in a `with`. Defining them does not change the SQL of plain `.select()` calls.

---

## 6. Eager loading vs. N+1

The naive way to fetch employees with their department is two queries per row — the textbook **N+1**. The Drizzle `with` clause issues a single query (or a small fixed number) regardless of result size.

This project exposes eager loading through a controlled query string:

```
GET /employees?include=department,profile,projects
GET /employees/:id?include=profile
GET /departments?includeEmployees=true
GET /projects/:id?includeMembers=true
```

Two security/perf rules:

1. **Allow-list the includable relations** — never pipe raw `?include=` into `with`. An attacker should not be able to traverse arbitrary tables.
2. **Cap the `pageSize`** when an include is active, or paginate the children. Eager-loading 10,000 projects per employee is a footgun.

---

## 7. REST design for related resources

| Pattern | Used for | Routes |
| --- | --- | --- |
| **Top-level resource** | Independent entities | `/employees`, `/departments`, `/projects` |
| **Sub-resource (1:1)** | Owned by one parent | `GET/PUT /employees/:id/profile` |
| **Sub-resource (collection)** | Lists scoped to a parent | `GET /employees/:id/projects`, `GET /projects/:id/members` |
| **Junction resource** | When the link itself is a thing | `POST /projects/:id/members`, `DELETE /projects/:id/members/:employeeId` |

Conventions used in this project:

- **`PUT` for upserts** on 1:1 sub-resources — the URL implies "the profile of employee X," so PUT semantics (create-or-replace) match.
- **`PATCH` for partial updates** on top-level resources — the body contains only changed fields.
- **`DELETE` returns `204 No Content`** — no body.
- **Composite-key sub-resources** put the parent's ID in the path and the child's discriminator after it: `/projects/:id/members/:employeeId`.

---

## 8. Validation with zod

Each DTO is a zod schema; the inferred TypeScript type is exported alongside it so the controller, service, and tests share one source of truth:

```ts
export const createProjectSchema = z.object({
  name: z.string().min(1).max(150),
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
}).strict()                                        // unknown keys → 400
  .refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  );

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
```

Three patterns used throughout:

- **`.strict()`** so unknown fields are rejected. Stops typos from being silently dropped.
- **`.refine()`** for cross-field rules (date order, conditional presence). Single-field rules belong on the field itself.
- **`createSchema.partial()`** for the corresponding update DTO, so they never drift apart.

A tiny `ZodValidationPipe` + `@ZodBody` / `@ZodQuery` / `@ZodParam` decorators convert zod failures into Nest's `BadRequestException` with the issue list attached.

---

## 9. Pagination, sorting, filtering

Every list endpoint accepts the same query contract:

| Param | Default | Notes |
| --- | --- | --- |
| `page` | `1` | 1-based |
| `pageSize` | `20` | Max `100` (rejected at the DTO) |
| `sortBy` | `createdAt` | **Allow-list** in the zod enum |
| `sortOrder` | `desc` | `asc \| desc` |
| `search` | — | Case-insensitive across selected text columns |
| Resource-specific filters | — | e.g. `departmentId`, `position`, `isActive` |
| `include` / `includeXxx` | — | Eager-load relations |

Response envelope:

```json
{
  "data": [/* rows */],
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

Implementation note: run the rows query and the `count(*)` in **parallel** with `Promise.all` — they're independent and the count is otherwise pure latency.

The `sortBy` allow-list (a `z.enum`) is the critical defense against arbitrary `ORDER BY` injection from the URL.

---

## 10. Mapping database errors to HTTP responses

A `500 Internal Server Error` on a duplicate email is a bug, not behavior. Catch the Postgres error and translate:

```ts
const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION     = '23503';
```

Drizzle wraps the underlying `pg` error on `.cause`, so check both layers:

```ts
private isUniqueViolation(err: unknown): boolean {
  return hasCode(err, PG_UNIQUE_VIOLATION)
    || hasCode((err as any)?.cause, PG_UNIQUE_VIOLATION);
}
```

Standard mappings used in this project:

| Postgres code | Meaning | HTTP status |
| --- | --- | --- |
| `23505` | unique violation | **`409 Conflict`** |
| `23503` | FK violation | **`409 Conflict`** (or `400` if it's a client-supplied bad ID) |
| `23502` | not-null violation | **`400 Bad Request`** (validation should catch this first) |
| `22P02` | invalid text representation (e.g. bad UUID) | **`400 Bad Request`** |

Anything not explicitly mapped becomes a real `500` — that way unexpected errors stay loud.

---

## 11. Migrations & seed strategy

**Migrations** live in `src/database/migrations/` and are produced by `drizzle-kit generate` from the schema files. They are **the** source of truth for the deployed shape — never edit a migration after it's been applied to a shared environment; create a new one.

```bash
pnpm db:generate     # diff schema vs. last migration → new SQL file
pnpm db:migrate      # apply pending migrations
```

**Seeding** is for predictable demo / dev data. The order matters because of FKs:

```
departments → employees → employee_profiles → projects → employee_projects
```

Two modes:

- `pnpm db:seed` — **additive**, idempotent (skips rows that conflict on unique columns).
- `pnpm db:seed:reset` — `TRUNCATE … RESTART IDENTITY CASCADE` first, then reseed.

Tests should never run against the dev seed; spin up a throwaway DB or a transaction-scoped fixture instead.

---

## 12. Project structure

```
2.CRUD & DB Modelling/
├── docker/postgres/init-databases.sh        # creates dev + prod DBs on first start
├── scripts/docker.sh                        # compose wrapper: up/down/logs/psql/nuke
├── src/
│   ├── common/
│   │   ├── decorators/zod.decorators.ts     # @ZodBody / @ZodQuery / @ZodParam
│   │   └── pipes/zod-validation.pipe.ts
│   ├── config/index.ts
│   ├── database/
│   │   ├── migrations/                      # generated SQL — do not edit manually
│   │   ├── seed/{departments,employees,projects}.seed.ts + index.ts
│   │   ├── database.module.ts               # global; provides DRIZZLE token
│   │   ├── database.constants.ts
│   │   ├── relations.ts                     # the relational query API
│   │   └── schema.ts                        # barrel re-export
│   ├── departments/{controller,service,module}.ts + dto/ + schema/
│   ├── employees/  {controller,service,module}.ts + dto/ + schema/
│   ├── projects/   {controller,service,module}.ts + dto/ + schema/
│   ├── app.module.ts
│   └── main.ts
├── .env.{development,production,example}
├── app.http
├── docker-compose.yml
├── dockerfile
├── drizzle.config.ts
├── package.json
├── README.md            ← you are here (concepts)
└── step-by-step.md      ← practical build guide
```

---

## 13. Daily workflow

```bash
# Bring up api + postgres
./scripts/docker.sh up

# Tail logs
./scripts/docker.sh logs

# psql against the active env
./scripts/docker.sh psql

# Rebuild after Dockerfile / dep changes
./scripts/docker.sh rebuild

# DB only, then run the API on the host with hot reload
./scripts/docker.sh db:up
pnpm start:dev

# Schema changes
pnpm db:generate && pnpm db:migrate

# Reset + reseed
./scripts/docker.sh nuke && ./scripts/docker.sh up && pnpm db:migrate && pnpm db:seed
```

Test endpoints from VS Code: open [app.http](./app.http), hit **Send Request** above any block.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `500 Internal Server Error` on `GET /employees` | DB has no schema (fresh volume) | `pnpm db:migrate` (then `pnpm db:seed`) |
| `getaddrinfo EAI_AGAIN postgres` | API container not on the compose network | `docker compose --env-file .env.development up -d --force-recreate postgres` |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Sibling project's postgres holds the port | Stop the other stack, **or** set `DB_PORT_HOST=5433` in `.env.development` |
| `database "..." does not exist` | `init-databases.sh` only runs on a fresh volume | `./scripts/docker.sh nuke && ./scripts/docker.sh up` |
| `42P01: relation "employees" does not exist` | Migrations not applied | `pnpm db:migrate` |
| `409 Conflict` on every POST | Composite-PK / unique violation triggered by stale seed data | `pnpm db:seed:reset` |
| pgAdmin / GUI: `temporary failure in name resolution` | Used `postgres` as host from your machine | Use `localhost` (the published port) |

---

## See also

- [step-by-step.md](./step-by-step.md) — practical, command-by-command build guide.
- [app.http](./app.http) — runnable request collection covering every endpoint and error case.
- [`drizzle-orm` docs — relations](https://orm.drizzle.team/docs/relations)
- [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
