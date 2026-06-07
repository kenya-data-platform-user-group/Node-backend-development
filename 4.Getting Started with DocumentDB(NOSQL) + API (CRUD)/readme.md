# BlogAPI — CRUD Workshop with DocumentDB

A production-structured NestJS REST API that teaches **NoSQL fundamentals** through a real blogging domain. Built with DocumentDB — an open-source, fully MongoDB-compatible database built on PostgreSQL — so you learn document-oriented patterns that transfer directly to AWS DocumentDB, MongoDB, and Cosmos DB.

---

## What You Will Learn

By working through this project you will understand:

- **How NoSQL stores data** — collections, documents, BSON, and why there is no fixed schema
- **The five core DocumentDB CRUD commands** — `find`, `insert`, `update`, `delete`, `findAndModify`
- **Aggregation** — `aggregate`, `count`, `distinct` for computed results across documents
- **NestJS architecture** — modules, controllers, services, and the DI lifecycle
- **Zod validation** — schema-first validation at the HTTP boundary, not buried in business logic
- **MongoDB driver patterns** — raw driver (no ODM) so you see exactly what hits the database

---

## NoSQL Fundamentals — Collections & Documents

### What is DocumentDB?

> *"Document flexibility meets PostgreSQL confidence"*

DocumentDB is a fully MongoDB-compatible open-source database built on PostgreSQL with native BSON support. It speaks the MongoDB wire protocol, so any MongoDB driver or tool works unchanged. It is MIT-licensed and runs locally via Docker.

**Industry backing:** Microsoft, Amazon, AB InBev, Rippling, YugabyteDB on the Technical Steering Committee. 3,200+ GitHub stars.

---

### SQL vs NoSQL Mental Model

| Concept      | SQL (Relational)     | DocumentDB (Document)                 |
| ------------ | -------------------- | ------------------------------------- |
| Storage unit | Row in a table       | **Document** in a collection    |
| Container    | Table                | **Collection**                  |
| Schema       | Fixed (migrations)   | Flexible (per-document)               |
| Relations    | Foreign keys + JOINs | Embedded docs or `postId` reference |
| ID           | Auto-increment INT   | `ObjectId` (12-byte BSON)           |
| Query lang   | SQL                  | MQL (MongoDB Query Language)          |

```
┌─────────────── SQL (Relational) ───────────────┐     ┌──────────── NoSQL (Document) ────────────┐
│                                                 │     │                                          │
│  Server                                         │     │  Server                                  │
│  └── Database                                   │     │  └── Database                            │
│       └── Table                                 │     │       └── Collection                     │
│            └── Row  (fixed columns)             │     │            └── Document  (flexible JSON) │
│                 └── Column                       │     │                 └── Field                │
│                                                 │     │                                          │
│  Example:                                       │     │  Example:                                │
│  postgres/                                      │     │  documentdb/                             │
│  └── blog_db/                                   │     │  └── blog/                               │
│       ├── posts (table)                         │     │       ├── posts (collection)             │
│       │    ├── id | title | author | ...        │     │       │    ├── { _id, title, author }    │
│       │    ├── 1  | "Hello" | "Alice"           │     │       │    ├── { _id, title, tags: [] }  │
│       │    └── 2  | "World" | "Bob"             │     │       │    └── { _id, title, extra: {} } │
│       └── comments (table)                      │     │       └── comments (collection)          │
│            └── id | post_id | content           │     │            └── { _id, postId, content }  │
│                                                 │     │                                          │
└─────────────────────────────────────────────────┘     └──────────────────────────────────────────┘
```

### How Relationships Work — SQL vs NoSQL

**SQL** enforces relationships with foreign keys and retrieves related data with JOINs.
**NoSQL** uses two patterns: **embedding** (nest related data inside the parent document) or **referencing** (store an ID and query separately).

```
┌──────────────── SQL: Foreign Keys + JOINs ─────────────────┐
│                                                             │
│  posts table                    comments table              │
│  ┌────┬──────────┬────────┐    ┌────┬─────────┬─────────┐  │
│  │ id │ title    │ author │    │ id │ post_id │ content │  │
│  ├────┼──────────┼────────┤    ├────┼─────────┼─────────┤  │
│  │ 1  │ "Hello"  │ "Alice"│    │ 1  │ 1       │ "Great!"│  │
│  │ 2  │ "World"  │ "Bob"  │    │ 2  │ 1       │ "Nice!" │  │
│  └────┴──────────┴────────┘    │ 3  │ 2       │ "Cool!" │  │
│          ▲                     └────┴────┬────┴─────────┘  │
│          │                               │                  │
│          └───── FOREIGN KEY (post_id) ───┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌──────────── NoSQL Option A: Embedding ─────────────────────┐
│                                                             │
│  posts collection                                           │
│  {                                                          │
│    _id: ObjectId("aaa"),                                    │
│    title: "Hello",                                          │
│    author: "Alice",                                         │
│    comments: [                    ◄── nested array          │
│      { author: "Carol", content: "Great!" },                │
│      { author: "Dave",  content: "Nice!"  }                 │
│    ]                                                        │
│  }                                                          │
│                                                             │
│  ✓ One read gets everything — no joins needed               │
│  ✗ Document grows unbounded if comments pile up             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌──────────── NoSQL Option B: Referencing ───────────────────┐
│                                                             │
│  posts collection              comments collection          │
│  {                             {                            │
│    _id: ObjectId("aaa"),         _id: ObjectId("bbb"),      │
│    title: "Hello",               postId: "aaa",  ◄── ref   │
│    author: "Alice"               author: "Carol",           │
│  }                               content: "Great!"          │
│                                }                            │
│                                                             │
│  ✓ Documents stay small and independent                     │
│  ✗ Two queries needed (or $lookup aggregation)              │
│                                                             │
│  ← This project uses Option B                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Querying relationships — side by side:**

```sql
-- SQL: Get a post with all its comments (JOIN)
SELECT p.*, c.content, c.author AS comment_author
FROM posts p
LEFT JOIN comments c ON c.post_id = p.id
WHERE p.id = 1;
```

```typescript
// NoSQL Option A (embedded): One query — comments are inside the document
const post = await posts.findOne({ _id: new ObjectId("aaa") });
// post.comments is already there — no second query

// NoSQL Option B (referencing): Two queries
const post = await posts.findOne({ _id: new ObjectId("aaa") });
const comments = await comments.find({ postId: "aaa" }).toArray();

// NoSQL Option B (single query with $lookup — equivalent to SQL JOIN):
const result = await posts.aggregate([
  { $match: { _id: new ObjectId("aaa") } },
  {
    $lookup: {
      from: "comments",          // the other collection
      localField: "_id",         // field in posts
      foreignField: "postId",    // field in comments
      as: "comments"             // output array name
    }
  }
]).toArray();
```

**When to embed vs reference:**

| Scenario                      | Embed                         | Reference                       |
| ----------------------------- | ----------------------------- | ------------------------------- |
| Read together always?         | Yes — embed                  | No — reference                 |
| Child grows without bound?    | Don't embed (16 MB doc limit) | Reference                       |
| Need to query children alone? | Awkward — must unwind        | Easy — query collection direct |
| Write frequency               | Low child writes — embed     | High child writes — reference  |

---

### Collections

A **collection** is the DocumentDB equivalent of a SQL table — a named group of documents inside a database. Collections are created implicitly on first write; no `CREATE TABLE` needed.

This project uses two collections:

```
blog (database)
├── posts       ← blog post documents
└── comments    ← comment documents
```

The driver targets a collection like this:

```typescript
// DatabaseService
const db = client.db('blog');
const posts = db.collection('posts');
```

---

### Documents

A **document** is a JSON object stored as BSON (Binary JSON). Each document in a collection can have different fields — there is no enforced schema at the database level (the app enforces it via Zod).

A `posts` document looks like:

```json
{
  "_id": { "$oid": "6a0cfa52fca52fb6fb01f0fb" },
  "title": "Getting Started with DocumentDB",
  "content": "DocumentDB is a JSON-native NoSQL database...",
  "author": "Alice",
  "tags": ["nosql", "documentdb", "tutorial"],
  "published": false,
  "createdAt": { "$date": "2026-05-20T03:00:00.000Z" },
  "updatedAt": { "$date": "2026-05-20T03:00:00.000Z" }
}
```

A `comments` document references its parent post by storing the `postId` string — a **manual reference** pattern:

```json
{
  "_id": { "$oid": "7b1dfa63gcb63gc7gc12g1gc" },
  "postId": "6a0cfa52fca52fb6fb01f0fb",
  "author": "Carol",
  "content": "Great intro! Really helped me understand DocumentDB.",
  "createdAt": { "$date": "2026-05-20T04:00:00.000Z" },
  "updatedAt": { "$date": "2026-05-20T04:00:00.000Z" }
}
```

> **Note on `_id`:** DocumentDB auto-generates a 12-byte `ObjectId` for every inserted document. It encodes a timestamp, machine ID, and counter — making it globally unique without a sequence table.

---

## Tech Stack

| Layer       | Technology                                  |
| ----------- | ------------------------------------------- |
| Runtime     | Node.js 22                                  |
| Framework   | NestJS 11                                   |
| Database    | DocumentDB (MongoDB-compatible, port 10260) |
| Driver      | `mongodb` 7 (raw driver, no ODM/Mongoose) |
| Validation  | Zod 4                                       |
| Language    | TypeScript 5.7                              |
| Container   | Docker + Docker Compose                     |
| Package mgr | pnpm                                        |

---

## Quick Start

### 1. Prerequisites

- Node.js 22+
- pnpm (`npm i -g pnpm`)
- Docker Desktop

### 2. Installation

```bash
cd "4.API + NOSQL (CRUD)"
pnpm install
```

### 3. Start DocumentDB

```bash
docker compose up documentdb
```

DocumentDB runs on port **10260** (not the default MongoDB 27017). The container uses a self-signed TLS certificate.

### 4. Configure Environment

The `.env` file is pre-configured to match the Docker Compose credentials:

```env
DATABASE_URL=mongodb://admin:password@localhost:10260?authSource=admin&tls=true&tlsAllowInvalidCertificates=true&directConnection=true
DATABASE_NAME=blog
PORT=3000
NODE_ENV=development
```

> **TLS flags explained:**
>
> - `tls=true` — DocumentDB requires TLS by default
> - `tlsAllowInvalidCertificates=true` — local container uses a self-signed cert
> - `directConnection=true` — skip topology discovery for a single-node instance

### 5. Run the API

```bash
pnpm start:dev
```

API available at `http://localhost:3000/api/v1`

### 6. Run Everything with Docker

```bash
docker compose up --build
```

---

## Project Structure

```
src/
├── app.module.ts                    # Root module — wires everything together
├── main.ts                          # Bootstrap — sets global prefix api/v1
│
├── config/
│   └── index.ts                     # Zod-validated env vars
│
├── common/
│   ├── decorators/
│   │   └── zod.decorators.ts        # @ZodBody / @ZodQuery / @ZodParam
│   ├── pipes/
│   │   └── zod-validation.pipe.ts   # Pipe wrapping any ZodSchema
│   └── schemas/
│       └── object-id.schema.ts      # Reusable ObjectId format validator
│
├── database/
│   ├── database.module.ts           # @Global module — one MongoClient for the app
│   └── database.service.ts          # Connects on init, exposes getCollection<T>()
│
└── modules/
    ├── posts/
    │   ├── schemas/index.ts          # Post interface (shape of the DB document)
    │   ├── dto/
    │   │   ├── create-post.dto.ts
    │   │   ├── update-post.dto.ts
    │   │   ├── posts-query.dto.ts    # Pagination / filter / sort query schema
    │   │   └── index.ts              # Barrel re-export
    │   ├── posts.service.ts          # All DocumentDB operations for posts
    │   ├── posts.controller.ts       # HTTP routes → service calls
    │   └── posts.module.ts
    │
    └── comments/
        ├── schemas/index.ts          # Comment interface
        ├── dto/
        │   ├── create-comment.dto.ts
        │   ├── update-comment.dto.ts
        │   ├── comments-query.dto.ts
        │   └── index.ts
        ├── comments.service.ts
        ├── comments.controller.ts
        └── comments.module.ts
```

---

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Posts

| Method     | Endpoint               | Description                                  |
| ---------- | ---------------------- | -------------------------------------------- |
| `GET`    | `/posts`             | List posts — filtering, sorting, pagination |
| `GET`    | `/posts/:id`         | Get a single post                            |
| `POST`   | `/posts`             | Create a post                                |
| `PATCH`  | `/posts/:id`         | Partially update a post                      |
| `PATCH`  | `/posts/:id/publish` | Set `published = true`                     |
| `DELETE` | `/posts/:id`         | Delete a post                                |

### Comments

| Method     | Endpoint                               | Description              |
| ---------- | -------------------------------------- | ------------------------ |
| `GET`    | `/posts/:postId/comments`            | List comments for a post |
| `POST`   | `/posts/:postId/comments`            | Add a comment            |
| `PATCH`  | `/posts/:postId/comments/:commentId` | Edit a comment           |
| `DELETE` | `/posts/:postId/comments/:commentId` | Delete a comment         |

### Query Parameters — `GET /posts`

| Param         | Type                                        | Default       |
| ------------- | ------------------------------------------- | ------------- |
| `published` | `true` \| `false`                       | —            |
| `author`    | string                                      | —            |
| `tag`       | string                                      | —            |
| `page`      | number (min 1)                              | `1`         |
| `limit`     | number (min 1, max 100)                     | `10`        |
| `sortBy`    | `createdAt` \| `updatedAt` \| `title` | `createdAt` |
| `sortOrder` | `asc` \| `desc`                         | `desc`      |

---

## CRUD Deep Dive — DocumentDB Commands

DocumentDB exposes five core **query and write commands** via the MongoDB wire protocol. The Node.js driver maps these directly.

---

### 1. `insert` — Create Documents

The `insert` command creates new documents in a collection. Each document gets an auto-generated `_id` of type `ObjectId`.

**Driver method:** `insertOne(doc)` / `insertMany(docs[])`

```typescript
// posts.service.ts — create()
const result = await this.posts.insertOne({
  title: 'Getting Started with DocumentDB',
  content: 'DocumentDB is a JSON-native NoSQL database...',
  author: 'Alice',
  tags: ['nosql', 'documentdb'],
  published: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// result.insertedId is the new ObjectId
console.log(result.insertedId); // ObjectId('6a0cfa52...')
```

After insert, the document exists in the `posts` collection:

```json
{
  "_id": { "$oid": "6a0cfa52fca52fb6fb01f0fb" },
  "title": "Getting Started with DocumentDB",
  "author": "Alice",
  "tags": ["nosql", "documentdb"],
  "published": false
}
```

---

### 2. `find` — Read Documents

The `find` command returns documents that match a filter. Supports **projection**, **sort**, **skip**, and **limit**.

**Driver method:** `find(filter, options)` / `findOne(filter)`

```typescript
// posts.service.ts — findAll()
const data = await this.posts
  .find({ published: true, tags: 'nosql' })  // filter
  .sort({ createdAt: -1 })                   // -1 = descending, 1 = ascending
  .skip(0)                                   // skip N for pagination
  .limit(10)                                 // max results per page
  .toArray();
```

**Common filter operators:**

```typescript
// Equality
{ author: 'Alice' }

// Comparison operators
{ year: { $gte: 2020 } }           // greater than or equal
{ year: { $lt: 2023 } }            // less than

// Array — docs where tags array contains 'nosql'
{ tags: 'nosql' }

// Multiple conditions (implicit AND)
{ published: true, author: 'Alice' }

// Logical OR
{ $or: [{ author: 'Alice' }, { author: 'Bob' }] }
```

**Pagination — data + total count in parallel:**

```typescript
// Promise.all fires both queries simultaneously — one round-trip
const [data, total] = await Promise.all([
  this.posts.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
  this.posts.countDocuments(filter),
]);

return {
  data,
  meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
};
```

---

### 3. `update` — Modify Documents

The `update` command modifies documents matching a filter using **update operators**. Using `$set` changes only the specified fields without touching the rest of the document.

**Driver method:** `updateOne(filter, update)` / `updateMany(filter, update)`

```typescript
// Update only the fields provided — other fields untouched
await this.posts.updateOne(
  { _id: new ObjectId(id) },
  { $set: { title: 'New Title', updatedAt: new Date() } },
);
```

**Core update operators:**

```typescript
// $set — add or change specific fields
{ $set: { published: true, updatedAt: new Date() } }

// $unset — remove a field from the document entirely
{ $unset: { draft: '' } }

// $push — append a value to an array field
{ $push: { tags: 'advanced' } }

// $pull — remove a value from an array
{ $pull: { tags: 'draft' } }

// $inc — increment a numeric field
{ $inc: { viewCount: 1 } }
```

---

### 4. `findAndModify` — Atomic Read + Update

The `findAndModify` command **atomically** finds, modifies, and returns a single document in one wire round-trip. With `returnDocument: 'after'` it returns the updated state, eliminating a separate read-after-write.

**Driver method:** `findOneAndUpdate(filter, update, options)`

```typescript
// posts.service.ts — update()
const result = await this.posts.findOneAndUpdate(
  { _id: new ObjectId(id) },
  { $set: { ...dto, updatedAt: new Date() } },
  { returnDocument: 'after' },   // return the new document, not the original
);

if (!result) throw new NotFoundException(`Post ${id} not found`);
return result;
```

> **Why use this instead of `updateOne` + `findOne`?**
> Two separate operations can see different states if another request modifies the document between them. `findOneAndUpdate` is atomic — consistent result, one round-trip.

---

### 5. `delete` — Remove Documents

The `delete` command removes documents matching a filter.

**Driver method:** `deleteOne(filter)` / `deleteMany(filter)`

```typescript
// Delete a single post by ID
const result = await this.posts.deleteOne({ _id: new ObjectId(id) });

// deletedCount === 0 means no document matched — throw 404
if (result.deletedCount === 0)
  throw new NotFoundException(`Post ${id} not found`);

// Cascade — delete all comments when a post is removed
await this.comments.deleteMany({ postId: id });
```

> **`deleteOne` vs `deleteMany`:** `deleteOne` stops after the first match. `deleteMany` removes every matching document. Always use `deleteOne` when deleting by `_id` since it is unique.

---

## Aggregation — Computing Results Across Documents

Aggregation processes documents through a **pipeline** of stages. Each stage receives the output of the previous one.

### `aggregate` — Pipeline

```typescript
// Count published posts grouped by author
const stats = await this.posts.aggregate([
  { $match: { published: true } },                          // Stage 1: filter
  { $group: { _id: '$author', count: { $sum: 1 } } },      // Stage 2: group + count
  { $sort: { count: -1 } },                                 // Stage 3: sort desc
]).toArray();

// Result:
// [{ _id: 'Alice', count: 5 }, { _id: 'Bob', count: 3 }]
```

**Common pipeline stages:**

| Stage                                                                                           | Purpose                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `$match`                                                                                      | Filter documents (same operators as `find`)       |
| `$group`   | Group by a field and compute aggregates (`$sum`, `$avg`, `$min`, `$max`) |                                                     |
| `$sort`                                                                                       | Sort the output                                     |
| `$project`                                                                                    | Shape output — include, exclude, or compute fields |
| `$limit`                                                                                      | Cap the number of results                           |
| `$skip`                                                                                       | Skip N results                                      |
| `$lookup`                                                                                     | Join documents from another collection              |

### `count` — Document Count

```typescript
// Count all published posts matching a filter
const total = await this.posts.countDocuments({ published: true });
```

### `distinct` — Unique Field Values

```typescript
// All unique authors in the collection
const authors = await this.posts.distinct('author');
// ['Alice', 'Bob', 'Carol']

// All unique tags across all posts
const tags = await this.posts.distinct('tags');
// ['nosql', 'documentdb', 'aggregation', 'tutorial']
```

---

## How the Code Works

### Validation at the Boundary

All input validation happens at the **controller layer** via Zod decorators — before data reaches the service:

```typescript
// zod.decorators.ts
export const ZodBody  = <T>(schema: ZodType<T>) => Body(new ZodValidationPipe(schema));
export const ZodQuery = <T>(schema: ZodType<T>) => Query(new ZodValidationPipe(schema));
export const ZodParam = <T>(schema: ZodType<T>, property?: string) =>
  property ? Param(property, new ZodValidationPipe(schema)) : Param(new ZodValidationPipe(schema));

// posts.controller.ts — dto is guaranteed valid by the time the service sees it
@Post()
create(@ZodBody(CreatePostSchema) dto: CreatePostDto) {
  return this.postsService.create(dto);
}

// ObjectId format validated at the param level — service gets a safe string
@Get(':id')
findOne(@ZodParam(ObjectIdSchema, 'id') id: string) {
  return this.postsService.findOne(id);
}
```

**Validation error response (400):**

```json
{
  "message": "Validation failed",
  "errors": {
    "issues": [
      { "path": ["title"], "message": "String must contain at least 1 character(s)" },
      { "path": ["author"], "message": "Required" }
    ]
  }
}
```

### NestJS Lifecycle & Database Connection

```typescript
// database.service.ts
async onModuleInit() {
  this.client = new MongoClient(uri);
  await this.client.connect();       // called by NestJS after DI is complete
}

// posts.service.ts — onModuleInit runs AFTER DatabaseService's — client is live
onModuleInit() {
  this.posts = this.db.getCollection<Post>('posts');
}
```

> **Why not the constructor?** The constructor runs during DI — before any lifecycle hook. `onModuleInit` is guaranteed to run in dependency order after all providers are resolved.

---

## Sample API Usage

Open `app.http` in VS Code with the **REST Client** extension to run all requests directly from the editor.

### Create a Post

```http
POST http://localhost:3000/api/v1/posts
Content-Type: application/json

{
  "title": "Getting Started with DocumentDB",
  "content": "DocumentDB is a JSON-native NoSQL database...",
  "author": "Alice",
  "tags": ["nosql", "documentdb", "tutorial"],
  "published": false
}
```

### List Posts with Filters

```http
GET http://localhost:3000/api/v1/posts?published=true&tag=nosql&sortBy=title&sortOrder=asc&page=1&limit=5
```

**Response:**

```json
{
  "data": [ ... ],
  "meta": { "total": 12, "page": 1, "limit": 5, "totalPages": 3 }
}
```

### Add a Comment

```http
POST http://localhost:3000/api/v1/posts/6a0cfa52fca52fb6fb01f0fb/comments
Content-Type: application/json

{
  "author": "Carol",
  "content": "Great intro! Really helped me understand DocumentDB."
}
```

---

## 🐳 Docker Reference

```bash
# DocumentDB only (for hot-reload dev)
docker compose up documentdb

# Full stack
docker compose up --build

# Tear down, keep data
docker compose down

# Tear down + wipe all data
docker compose down -v
```

**Connect with Compass or mongosh:**

```
mongodb://admin:password@localhost:10260/?authSource=admin&tls=true&tlsAllowInvalidCertificates=true&directConnection=true
```

### Run Query Playground Commands in VS Code (DocumentDB Extension)

This repo includes a ready-to-run Query Playground script:

- `admin@localhost-10260_blog.documentdb.js`

It contains useful setup and CRUD commands (ping, create collections, insert/find/update/delete, filters, and aggregation).

How to run it with the DocumentDB VS Code extension:

1. Install/open the **DocumentDB** extension in VS Code.
2. Start the local database container:

```bash
docker compose up documentdb
```

3. Open `admin@localhost-10260_blog.documentdb.js`.
4. Connect to `admin@localhost:10260/blog` in the DocumentDB extension connection panel.
5. Open the connected Query Playground for that connection (or use this file directly if it already opens as playground).
6. Run commands from the file:

- `Ctrl+Enter` to run the current statement/block
- `Ctrl+Shift+Enter` to run the full file

Tip: when running multiple statements, the playground shows the result of the last executed statement.

---

## ⚙️ Environment Variables

| Variable          | Default              | Description                               |
| ----------------- | -------------------- | ----------------------------------------- |
| `PORT`          | `3000`             | HTTP server port                          |
| `NODE_ENV`      | `development`      | Environment mode                          |
| `DATABASE_URL`  | DocumentDB local URI | Full MongoDB-compatible connection string |
| `DATABASE_NAME` | `blog`             | Database name inside DocumentDB           |

---

## Development Scripts

```bash
pnpm start:dev    # Hot-reload dev server
pnpm build        # Compile TypeScript → dist/
pnpm start:prod   # Run compiled output
pnpm lint         # ESLint with auto-fix
pnpm test         # Jest unit tests
pnpm test:e2e     # End-to-end tests
```

---

## Common Issues

**`TypeError: Cannot read properties of undefined (reading 'db')`**
A service tried to use `getCollection()` in its constructor before the DB client connected. Move collection assignment to `onModuleInit()`.

**`MongoServerError: Authentication failed`**
Credentials in `DATABASE_URL` do not match the `--username` / `--password` flags in `docker-compose.yml`.

**`BSONError: input must be a 24 character hex string`**
An invalid ObjectId string reached `new ObjectId()`. Use `@ZodParam(ObjectIdSchema, 'id')` on all `:id` route params to catch this at the boundary.

**DocumentDB container not starting**
Pull the image manually to confirm registry access:

```bash
docker pull ghcr.io/documentdb/documentdb/documentdb-local:latest
```

---

## License

MIT — built for teaching purposes.
