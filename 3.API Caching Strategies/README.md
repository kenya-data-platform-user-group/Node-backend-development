# API Caching Strategies

A production-ready REST API built with **NestJS 11**, **Drizzle ORM**, **PostgreSQL 16**, and **Redis 7**, fully containerized with Docker Compose.

This chapter focuses on **API caching strategies**: reducing repeated work for frequently requested data so the API can respond faster, absorb higher traffic, and put less pressure on PostgreSQL.

## API Caching Strategies and Benefits

API caching is the practice of storing the result of expensive or frequently repeated operations, then serving that stored result for later requests until it expires or is invalidated. In a NestJS application, that can mean caching full HTTP responses, specific service-layer queries, or derived dashboard-style aggregates.

For this project, caching matters because event listing and event detail endpoints often have read-heavy traffic patterns. Without caching, the application repeats the same database queries, serialization work, and network round-trips even when the underlying data has not changed.

The main benefits are:

- **Lower latency**: cached responses return much faster than recomputing the same result on every request.
- **Reduced database load**: fewer duplicate reads reach PostgreSQL, which helps preserve capacity for writes and complex queries.
- **Better scalability**: the API can handle more concurrent traffic before CPU, I/O, or database bottlenecks appear.
- **More predictable performance**: hot endpoints stay responsive during traffic spikes because repeated requests reuse previously computed results.
- **Improved cost efficiency**: less repeated work means better use of container, database, and infrastructure resources.

As you work through this module, the goal is not just to "turn caching on," but to choose the right caching layer, set sensible TTLs, and understand when cached data should be refreshed or invalidated.

## API Caching Strategies Used in This Project

This module uses a small set of practical caching strategies that are common in production APIs:

| Strategy | How it works here | Benefit |
| --- | --- | --- |
| **Redis-backed distributed cache** | NestJS uses `@nestjs/cache-manager` with Keyv and Redis as the shared backing store. | Cached data survives across requests and works consistently when the API is scaled beyond a single process. |
| **Cache-aside for reads** | The service checks Redis first for list and detail queries. On a miss, it reads from PostgreSQL, returns the result, then stores it in cache. | Keeps write paths simple while accelerating repeated read traffic. |
| **Per-endpoint TTLs** | List responses use `CACHE_TTL_MS` (60s), detail responses use `CACHE_DETAIL_TTL_MS` (120s), and the list version key uses `CACHE_VERSION_TTL_MS` (24h). | Lets the API keep frequently changing collections fresher while allowing detail records or version keys to live longer. |
| **Query-aware cache keys** | List keys include page, filters, sorting, and other query parameters so each distinct query gets its own cache entry. | Prevents one query result from incorrectly being reused for a different filter or pagination combination. |
| **Versioned collection cache keys** | List cache keys are prefixed with a logical version such as `events:list:v3`. When writes happen, the version increments. | Invalidates all cached list variants at once without scanning and deleting many individual keys. |
| **Targeted detail invalidation** | When an event is updated or deleted, only that event's detail cache key is removed directly. | Avoids unnecessary cache churn and keeps invalidation focused on the modified entity. |
| **Cache visibility in responses** | Cached endpoints return metadata showing the strategy, cache key, TTL, and whether the response was a hit or miss. | Makes caching easier to explain, debug, and verify during development. |

In practice, the request flow looks like this:

1. A client requests an event list or event detail endpoint.
2. The service builds a deterministic cache key and checks Redis.
3. If the key exists, the API returns the cached payload immediately.
4. If the key does not exist, the API queries PostgreSQL, stores the response in Redis with a TTL, and returns the fresh result.
5. If a write occurs, the API deletes the affected detail key and bumps the list version so older list caches become obsolete.

This combination is intentionally simple: it demonstrates **cache-aside**, **TTL-based expiration**, and **write-triggered invalidation** without introducing unnecessary complexity early in the module.

---

## Architecture Diagrams

### 1. Overall System Architecture with Caching

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT                            │
│            (API Consumer / Frontend)                 │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ HTTP Requests
                     ▼
┌──────────────────────────────────────────────────────┐
│              NESTJS APPLICATION                      │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │       Events Module                        │    │
│  │                                            │    │
│  │  ┌──────────────┐   ┌──────────────┐     │    │
│  │  │  Controller  │   │   Service    │     │    │
│  │  │              │   │              │     │    │
│  │  │ GET /        │──▶│ findAll()    │──┐  │    │
│  │  │ GET /:id     │──▶│ findOne()    │  │  │    │
│  │  │ POST /       │──▶│ create()     │  │  │    │
│  │  │ PATCH /:id   │──▶│ update()     │  │  │    │
│  │  │ DELETE /:id  │──▶│ remove()     │  │  │    │
│  │  └──────────────┘   └──────┬───────┘  │  │    │
│  └─────────────────────────────┼──────────┼──┘    │
│                                │          │        │
│                                │          │        │
└────────────────────────────────┼──────────┼────────┘
                                 │          │
                    ┌────────────┘          └─────────────┐
                    │                                     │
                    │ Check Cache First                   │ Write-through
                    ▼                                     ▼
            ┌───────────────┐                     ┌───────────────┐
            │  REDIS CACHE  │                     │  PostgreSQL   │
            │               │                     │               │
            │  Key-Value    │◀────────────────────│  events       │
            │  Store        │  Cache on Read      │  table        │
            │               │                     │               │
            │  TTL: 60s-24h │                     │  ACID, Joins  │
            └───────────────┘                     └───────────────┘
                    │
                    │ Cache Hit/Miss
                    │
    ┌───────────────┴────────────────┐
    │                                │
    ▼ CACHE HIT                      ▼ CACHE MISS
Return cached data         Query PostgreSQL → Cache result → Return
(Fast ~1-5ms)              (Slower ~20-100ms, first time only)
```

### 2. Cache-Aside Pattern (Read Flow)

```
Client Request: GET /events?page=1&pageSize=10&category=webinar

┌──────────┐
│  Client  │
└────┬─────┘
     │ GET /events?page=1&pageSize=10&category=webinar
     ▼
┌─────────────────────────────────────────────────────┐
│ Events Controller                                   │
│ @Get()                                              │
│ findAll(@ZodQuery query)                            │
└────┬────────────────────────────────────────────────┘
     │ Pass validated query params
     ▼
┌─────────────────────────────────────────────────────┐
│ Events Service                                      │
│ findAll(query)                                      │
│                                                     │
│ Step 1: Get list version from Redis                │
│ Step 2: Build cache key                            │
│ key = "events:list:v3:category=webinar&page=1&..." │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Check Redis Cache                                   │
│ GET "events:list:v3:category=webinar&page=1&..."   │
└────┬───────────────────────┬────────────────────────┘
     │                       │
     │ CACHE HIT             │ CACHE MISS
     │ (Key exists)          │ (Key doesn't exist)
     ▼                       ▼
┌──────────────┐      ┌────────────────────────────┐
│ Return       │      │ Query PostgreSQL           │
│ cached data  │      │                            │
│              │      │ SELECT * FROM events       │
│ ⚡ Fast:     │      │ WHERE category = 'webinar' │
│ ~1-5ms       │      │ LIMIT 10 OFFSET 0         │
└──────────────┘      └────┬───────────────────────┘
                           │ Got fresh data
                           ▼
                    ┌──────────────────────────────┐
                    │ Store in Redis               │
                    │                              │
                    │ SET key, data, TTL=60000ms   │
                    │ "events:list:v3:..."         │
                    └────┬─────────────────────────┘
                         │
                         ▼
                    ┌──────────────────────────────┐
                    │ Return fresh data            │
                    │                              │
                    │ Slower (first time):         │
                    │ ~20-100ms                    │
                    └──────────────────────────────┘

Timeline:
Request 1: MISS → Query DB → Cache → Return (100ms)
Request 2: HIT  → Return cached (2ms) ⚡
Request 3: HIT  → Return cached (2ms) ⚡
... (until TTL expires after 60 seconds)
Request N: MISS → Query DB → Cache → Return (100ms)
```

### 3. Cache Invalidation on Write

```
Write Operation: PATCH /events/:id

┌──────────┐
│  Client  │
└────┬─────┘
     │ PATCH /events/abc-123
     │ {title: "Updated Title", capacity: 80}
     ▼
┌─────────────────────────────────────────────────────┐
│ Events Controller                                   │
│ @Patch(':id')                                       │
│ update(@Param id, @ZodBody dto)                     │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Events Service                                      │
│ update(id, dto)                                     │
│                                                     │
│ Step 1: Update in PostgreSQL                       │
│ UPDATE events SET title='...', capacity=80         │
│ WHERE id='abc-123'                                  │
└────┬────────────────────────────────────────────────┘
     │ Update successful
     ▼
┌─────────────────────────────────────────────────────┐
│ Invalidate Related Caches (in parallel)            │
│                                                     │
│ 1. Delete detail cache:                            │
│    DEL "events:detail:abc-123"                     │
│                                                     │
│ 2. Bump list version:                              │
│    GET "events:list:version" → 3                   │
│    SET "events:list:version" → 4                   │
│                                                     │
│ Result: All old list caches become unreachable     │
│ (keys still exist but have wrong version prefix)   │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Return updated event row                            │
└─────────────────────────────────────────────────────┘

Cache State Before Update:
┌───────────────────────────────────────────────────────┐
│ Redis Cache                                           │
│                                                       │
│ "events:detail:abc-123" → {id:abc-123, title:...}    │
│ "events:list:v3:page=1&..." → [{event1}, {event2}]  │
│ "events:list:version" → 3                            │
└───────────────────────────────────────────────────────┘

Cache State After Update:
┌───────────────────────────────────────────────────────┐
│ Redis Cache                                           │
│                                                       │
│ "events:detail:abc-123" → (DELETED) ✓               │
│ "events:list:v3:page=1&..." → (STALE, never served) │
│ "events:list:version" → 4 (BUMPED) ✓                │
└───────────────────────────────────────────────────────┘

Next List Request:
- Builds key: "events:list:v4:page=1&..." (new version!)
- Cache MISS (old v3 keys are never looked up)
- Queries PostgreSQL with fresh data
- Caches with new v4 key
```

### 4. Versioned Collection Cache Keys

```
Problem: Invalidating All List Variants is Hard

Without Versioning:
┌──────────────────────────────────────────────────────────┐
│ Redis has many list cache keys:                          │
│                                                          │
│ "events:list:page=1&pageSize=10"                        │
│ "events:list:page=2&pageSize=10"                        │
│ "events:list:category=webinar&page=1&pageSize=20"       │
│ "events:list:search=redis&sortBy=title&sortOrder=asc"   │
│ "events:list:status=published&upcoming=true"            │
│ ... (hundreds of filter/sort/page combinations!)        │
│                                                          │
│ On write: Must scan and delete ALL these keys? ❌       │
│ (Slow, error-prone, O(n) key scanning)                  │
└──────────────────────────────────────────────────────────┘

With Versioning:
┌──────────────────────────────────────────────────────────┐
│ Redis has version-prefixed keys:                         │
│                                                          │
│ Version 3 (before write):                                │
│ "events:list:v3:page=1&pageSize=10"                     │
│ "events:list:v3:category=webinar&page=1&pageSize=20"    │
│ "events:list:v3:status=published&upcoming=true"         │
│                                                          │
│ Version Key:                                             │
│ "events:list:version" → 3                               │
└──────────────────────────────────────────────────────────┘
                 │
                 │ WRITE OCCURS (create/update/delete)
                 ▼
┌──────────────────────────────────────────────────────────┐
│ Bump Version:                                            │
│ SET "events:list:version" → 4                           │
│ (single O(1) operation)                                  │
└──────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ New requests use v4:                                     │
│                                                          │
│ "events:list:v4:page=1&pageSize=10" (MISS → fresh DB)  │
│ "events:list:v4:category=webinar&..." (MISS → fresh DB)│
│                                                          │
│ Old v3 keys still exist but are NEVER looked up! ✓     │
│ They expire naturally when their 60s TTL runs out       │
└──────────────────────────────────────────────────────────┘

Benefits:
✅ No key scanning required
✅ O(1) invalidation (single SET operation)
✅ Old keys expire naturally via TTL
✅ Simple and performant
```

### 5. TTL-Based Expiration

```
Cache Entry Lifecycle:

t=0s: Cache Entry Created (after a cache miss)
┌─────────────────────────────────────────────────────┐
│ Redis                                               │
│                                                     │
│ Key: "events:detail:abc-123"                       │
│ Value: {id: "abc-123", title: "NestJS Conf", ...}  │
│ TTL: 120000ms (2 minutes)                          │
│                                                     │
│ SET key value PX 120000                            │
└─────────────────────────────────────────────────────┘

t=60s (1 minute later):
┌─────────────────────────────────────────────────────┐
│ Key still exists                                    │
│ TTL: ~60000ms remaining                            │
│                                                     │
│ GET key → Returns cached value ✓ (hit: true)      │
└─────────────────────────────────────────────────────┘

t=120s (2 minutes later):
┌─────────────────────────────────────────────────────┐
│ Key EXPIRED (TTL reached 0)                        │
│                                                     │
│ GET key → Returns NULL (cache miss, hit: false)    │
└─────────────────────────────────────────────────────┘
         │
         │ Next request triggers fresh DB query
         ▼
┌─────────────────────────────────────────────────────┐
│ Query PostgreSQL → Cache new value with fresh TTL  │
│ TTL: 120000ms (resets)                             │
└─────────────────────────────────────────────────────┘

TTL Configuration (from .env.development):

┌─────────────────────────┬───────────┬─────────────────────────────┐
│ Cache Key Pattern       │ TTL       │ Reason                      │
├─────────────────────────┼───────────┼─────────────────────────────┤
│ events:list:v*:*        │ 60s       │ Lists change often (writes) │
│ events:detail:*         │ 120s      │ Detail pages more stable    │
│ events:list:version     │ 24 hours  │ Version coordination key    │
└─────────────────────────┴───────────┴─────────────────────────────┘

Env vars:
  CACHE_TTL_MS=60000          (1 minute)
  CACHE_DETAIL_TTL_MS=120000  (2 minutes)
  CACHE_VERSION_TTL_MS=86400000 (24 hours)
```

### 6. Query-Aware Cache Keys

```
Different Queries = Different Cache Keys

The buildEventsListCacheKey() function sorts query params alphabetically
and embeds them in the key, ensuring unique cache entries per query.

Request 1: GET /events?page=1&pageSize=10
┌─────────────────────────────────────────────────────────────┐
│ version = GET "events:list:version" → 3                     │
│ key = "events:list:v3:page=1&pageSize=10&sortBy=startsAt&  │
│        sortOrder=asc&upcoming=false"                        │
└─────────────────────────────────────────────────────────────┘

Request 2: GET /events?category=webinar
┌─────────────────────────────────────────────────────────────┐
│ version = GET "events:list:version" → 3                     │
│ key = "events:list:v3:category=webinar&page=1&pageSize=20& │
│        sortBy=startsAt&sortOrder=asc&upcoming=false"        │
│                                                             │
│ Different key! ✓ (category filter added)                   │
└─────────────────────────────────────────────────────────────┘

Request 3: GET /events?page=2&pageSize=10
┌─────────────────────────────────────────────────────────────┐
│ version = GET "events:list:version" → 3                     │
│ key = "events:list:v3:page=2&pageSize=10&sortBy=startsAt&  │
│        sortOrder=asc&upcoming=false"                        │
│                                                             │
│ Different key! ✓ (page changed)                            │
└─────────────────────────────────────────────────────────────┘

Request 4: GET /events?search=redis&status=published
┌─────────────────────────────────────────────────────────────┐
│ version = GET "events:list:version" → 3                     │
│ key = "events:list:v3:page=1&pageSize=20&search=redis&     │
│        sortBy=startsAt&sortOrder=asc&status=published&     │
│        upcoming=false"                                      │
│                                                             │
│ Different key! ✓ (search + status filter)                  │
└─────────────────────────────────────────────────────────────┘

Key Construction (src/modules/database/cache/cache.keys.ts):
- Sort query params alphabetically for deterministic keys
- Omit null/undefined params
- Prefix with version: "events:list:v{N}:{sorted_params}"

Result:
✅ Each unique query combination gets its own cache
✅ No cache collision between different queries
✅ Deterministic — same params always produce the same key
```

### 7. Cache Response Metadata

```
Every API response includes a `cache` object for observability:

GET /events?category=webinar

Response:
{
  "data": [
    {title: "Redis for Backend Engineers", category: "webinar", ...},
    {title: "Caching Strategies for Event APIs", category: "webinar", ...}
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 2,
    "totalPages": 1
  },
  "cache": {
    "strategy": "cache-aside",
    "key": "events:list:v3:category=webinar&page=1&pageSize=20&...",
    "hit": true,           ← Served from Redis!
    "ttlMs": 60000         ← Expires in 60 seconds
  }
}

What each field tells you:
  strategy  → "cache-aside" (read-through on miss)
  key       → The exact Redis key used (inspect with redis-cli)
  hit       → true = from cache, false = fresh from PostgreSQL
  ttlMs     → How long this entry lives before automatic expiry

Use this metadata to:
✅ Verify caching is working during development
✅ Debug unexpected stale data (check hit + ttlMs)
✅ Monitor hit rates across endpoints
✅ Teach caching concepts in workshops!
```

---

> This project is the basis for the [API Caching Strategies workshop](./app.http) by the Kenya Data Platform User Group. If you're attending, follow the steps below — they're written so you can build the project from scratch alongside us.

---

## Table of Contents

- [API Caching Strategies and Benefits](#api-caching-strategies-and-benefits)
- [API Caching Strategies Used in This Project](#api-caching-strategies-used-in-this-project)
- [Architecture Diagrams](#architecture-diagrams)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Seed Data](#seed-data)
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
| Cache store | **Redis 7** | Fast in-memory cache for shared API response storage |
| Cache integration | **@nestjs/cache-manager** + **@keyv/redis** | Simple cache-aside integration with explicit TTL control |
| Validation | **zod 4** | Runtime + compile-time type safety |
| Config | **`@nestjs/config`** + **dotenv** | Per-env file loading with schema validation |
| Package mgr | **pnpm 9** (via corepack) | Fast, deterministic |
| Container | **Docker** + **Compose v2** | Reproducible local stack |

---

## Project Structure

```
3.API Caching Strategies/
├── docker/
│   └── postgres/
│       └── init-databases.sh           # creates dev DB on first start
├── src/
│   ├── common/
│   │   ├── decorators/zod.decorators.ts
│   │   ├── errors/postgres-error.helpers.ts
│   │   └── pipes/zod-validation.pipe.ts
│   ├── config/
│   │   └── index.ts                    # zod-validated env config schema
│   ├── modules/
│   │   ├── database/
│   │   │   ├── cache/
│   │   │   │   └── cache.keys.ts       # versioned key builders
│   │   │   ├── migrations/             # generated SQL (drizzle-kit)
│   │   │   ├── seed/
│   │   │   │   ├── events.seed.ts      # 6 workshop events
│   │   │   │   └── index.ts            # seed runner script
│   │   │   ├── database.constants.ts   # DRIZZLE token + DrizzleDB type
│   │   │   ├── database.module.ts      # Pool + Drizzle provider
│   │   │   └── schema.ts              # barrel for drizzle schemas
│   │   └── events/
│   │       ├── dto/
│   │       │   ├── create-event.dto.ts  # zod schema + type
│   │       │   ├── list-events.dto.ts   # pagination/filter schema
│   │       │   └── update-event.dto.ts  # partial schema
│   │       ├── schema/event.schema.ts   # drizzle table definition
│   │       ├── events.controller.ts     # REST endpoints
│   │       ├── events.module.ts
│   │       └── events.service.ts        # caching logic lives here
│   ├── app.module.ts                    # root module (Config + Cache + DB + Events)
│   └── main.ts
├── .env.development                     # dev env vars (Redis URL, TTLs)
├── app.http                             # workshop HTTP requests (6 lessons)
├── docker-compose.yml                   # api + postgres + redis
├── dockerfile
├── drizzle.config.ts
├── package.json
└── README.md
```

---

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | >= 22 |
| pnpm | >= 9 (`corepack enable && corepack prepare pnpm@9 --activate`) |
| Docker Engine + Compose v2 | >= 20.10 |
| Git | latest |
| VS Code | with REST Client extension (for `app.http`) |

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL + Redis containers
pnpm docker:up

# 3. Push schema to database (or generate + migrate)
pnpm db:push

# 4. Seed with 6 workshop events
pnpm db:seed

# 5. Start the API with hot reload
pnpm start:dev
```

The API is now running at `http://localhost:8000`. Open `app.http` in VS Code and work through the lessons.

---

## Seed Data

The seed script (`pnpm db:seed`) inserts 6 events designed to demonstrate different caching scenarios:

| Title | Category | Status | Virtual | Purpose |
| --- | --- | --- | --- | --- |
| NestJS API Performance Clinic | workshop | published | No | In-person workshop, tests category filter |
| Redis for Backend Engineers | webinar | published | Yes | Virtual event, tests isVirtual filter |
| Event-Driven Systems Meetup | meetup | published | No | Tests search across title/location/organizer |
| gRPC in Production | conference | draft | No | Tests status=draft filter |
| Caching Strategies for Event APIs | webinar | published | Yes | Tests combined filters (webinar + virtual) |
| Cancelled DevOps Bootcamp | workshop | cancelled | No | Tests status=cancelled filter, invalidation |

These events cover all categories (`conference`, `meetup`, `workshop`, `webinar`, `hackathon`), multiple statuses (`draft`, `published`, `cancelled`), and both virtual/in-person modes.

---

## Daily Workflow

```bash
# Bring up the full stack (api + postgres + redis)
pnpm docker:up

# Tail logs
pnpm docker:logs

# Start API with hot reload (requires postgres + redis running)
pnpm start:dev

# Database operations
pnpm db:generate    # generate migration SQL from schema changes
pnpm db:migrate     # apply migrations
pnpm db:push        # push schema directly (dev shortcut)
pnpm db:seed        # seed events (additive, skips existing slugs)
pnpm db:seed:reset  # truncate + re-seed
pnpm db:studio      # open Drizzle Studio GUI

# Shut down containers
pnpm docker:down
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :::8000` | The api container already owns port 8000. Run `pnpm docker:down` or change `PORT`. |
| `getaddrinfo EAI_AGAIN postgres` | You're running a host script with the in-container `DATABASE_URL`. Create `.env.development.local` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/event_cache_db_development`. |
| `DATABASE_URL is not set` in seed | The seed loads env from project root. Check `.env.development` exists with `DATABASE_URL`. |
| `database "..." does not exist` | The init script only runs on a **fresh** volume. Run `docker compose down -v && pnpm docker:up`. |
| `409 Conflict` on create | Duplicate slug — the seed data already contains that slug. Use a unique one. |
| `cache.hit` always `false` | Check Redis is running: `docker exec api-caching-strategies-redis redis-cli ping`. |
| Stale data after update | Expected! Wait for TTL expiry or observe that the next GET after a write returns `hit: false`. |

---

Made for the Kenya Data Platform User Group community.
