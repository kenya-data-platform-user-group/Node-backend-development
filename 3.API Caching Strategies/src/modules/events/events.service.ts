import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  or,
  type SQL,
} from 'drizzle-orm';
import { isUniqueViolation } from '../../common/errors/postgres-error.helpers';
import type { Config } from '../../config';
import {
  EVENTS_LIST_VERSION_KEY,
  buildEventsListCacheKey,
  eventDetailCacheKey,
} from '../database/cache/cache.keys';
import { DRIZZLE, type DrizzleDB } from '../database/database.constants';
import type {
  CachedCollectionResponse,
  CachedItemResponse,
  ListEventsDto,
  PaginationMeta,
} from './dto/list-events.dto';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import { events, type EventRow } from './schema/event.schema';

/**
 * Caching Strategy: Cache-Aside (Lazy Loading)
 *
 * How it works:
 *   1. On READ  → check cache first; if hit, return cached data; if miss, query DB, store in cache, return.
 *   2. On WRITE → perform DB mutation, then invalidate affected cache entries.
 *
 * Invalidation approach: Version-based invalidation for list queries.
 *   - A global "list version" counter lives in Redis.
 *   - List cache keys embed the current version, so after a bump all old keys become
 *     unreachable — effectively invalidating every cached list permutation in O(1).
 *   - Detail (single-item) caches are invalidated by explicit key deletion on update/delete.
 *
 * Why version-based instead of deleting list keys?
 *   - List queries have many permutations (filters, sort, page). Scanning Redis for matching
 *     keys is expensive. Bumping one version number orphans them all instantly;
 *     Redis reclaims memory when their TTL naturally expires.
 */
@Injectable()
export class EventsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService<Config, true>,
  ) {}

  async create(dto: CreateEventDto): Promise<EventRow> {
    try {
      const [row] = await this.db
        .insert(events)
        .values(this.toInsertPayload(dto))
        .returning();
      // Invalidate all list caches — a new item means every cached page is potentially stale.
      await this.bumpListVersion();
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          `Event with slug "${dto.slug}" already exists`,
        );
      }
      throw err;
    }
  }

  async findAll(
    query: ListEventsDto,
  ): Promise<CachedCollectionResponse<EventRow>> {
    const {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      category,
      status,
      isVirtual,
      upcoming,
    } = query;

    // Step 1: Build a versioned cache key. The version changes on every write,
    // so old cached pages become unreachable without explicit deletion.
    const listVersion = await this.getListVersion();
    const cacheKey = buildEventsListCacheKey(listVersion, query);

    // Step 2: Cache-aside read — check Redis before querying the database.
    const cached = await this.cacheManager.get<{
      data: EventRow[];
      meta: PaginationMeta;
    }>(cacheKey);

    if (cached) {
      return {
        ...cached,
        cache: this.createCacheMeta(cacheKey, true, this.listTtlMs),
      };
    }

    const filters: SQL[] = [];
    if (search) {
      const pattern = `%${search}%`;
      const searchFilter = or(
        ilike(events.title, pattern),
        ilike(events.location, pattern),
        ilike(events.organizer, pattern),
      );
      if (searchFilter) filters.push(searchFilter);
    }
    if (category) filters.push(eq(events.category, category));
    if (status) filters.push(eq(events.status, status));
    if (isVirtual !== undefined) filters.push(eq(events.isVirtual, isVirtual));
    if (upcoming) filters.push(gte(events.startsAt, new Date()));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const orderFn = sortOrder === 'asc' ? asc : desc;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(events)
        .where(whereClause)
        .orderBy(orderFn(events[sortBy]))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(events).where(whereClause),
    ]);

    const payload = {
      data: rows,
      meta: {
        page,
        pageSize,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
      },
    };

    // Step 3: Cache miss — store the fresh DB result so the next identical request is served from cache.
    await this.cacheManager.set(cacheKey, payload, this.listTtlMs);

    return {
      ...payload,
      cache: this.createCacheMeta(cacheKey, false, this.listTtlMs),
    };
  }

  async findOne(id: string): Promise<CachedItemResponse<EventRow>> {
    const cacheKey = eventDetailCacheKey(id);

    // Cache-aside: try cache before hitting the database.
    const cached = await this.cacheManager.get<{ data: EventRow }>(cacheKey);

    if (cached) {
      return {
        ...cached,
        cache: this.createCacheMeta(cacheKey, true, this.detailTtlMs),
      };
    }

    const [row] = await this.db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    const payload = { data: row };
    await this.cacheManager.set(cacheKey, payload, this.detailTtlMs);

    return {
      ...payload,
      cache: this.createCacheMeta(cacheKey, false, this.detailTtlMs),
    };
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventRow> {
    if (Object.keys(dto).length === 0) {
      return (await this.findOne(id)).data;
    }

    try {
      const [row] = await this.db
        .update(events)
        .set({ ...this.toUpdatePayload(dto), updatedAt: new Date() })
        .where(eq(events.id, id))
        .returning();

      if (!row) {
        throw new NotFoundException(`Event ${id} not found`);
      }

      // Invalidate: delete the stale detail entry + bump version to orphan all list caches.
      await Promise.all([
        this.cacheManager.del(eventDetailCacheKey(id)),
        this.bumpListVersion(),
      ]);

      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          `Event with slug "${dto.slug}" already exists`,
        );
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(events)
      .where(eq(events.id, id))
      .returning({ id: events.id });

    if (result.length === 0) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    // Invalidate detail cache + bump list version (counts and page offsets shift after deletion).
    await Promise.all([
      this.cacheManager.del(eventDetailCacheKey(id)),
      this.bumpListVersion(),
    ]);
  }

  // ─── TTL Configuration ──────────────────────────────────────────────────────
  // TTLs are externalized to env vars so they can be tuned per environment
  // without code changes (shorter in dev for fast feedback, longer in prod for performance).

  private get listTtlMs(): number {
    return this.configService.get('cache_ttl_ms', { infer: true });
  }

  private get detailTtlMs(): number {
    return this.configService.get('cache_detail_ttl_ms', { infer: true });
  }

  private get versionTtlMs(): number {
    return this.configService.get('cache_version_ttl_ms', { infer: true });
  }

  // ─── Version-Based List Invalidation ────────────────────────────────────────
  // Instead of scanning Redis for every cached list key on writes, we maintain a
  // single version counter. List cache keys include the version, so incrementing
  // it makes all previous entries unreachable. Redis cleans them up at TTL expiry.

  private async getListVersion(): Promise<number> {
    const current = await this.cacheManager.get<number>(
      EVENTS_LIST_VERSION_KEY,
    );
    if (typeof current === 'number' && Number.isFinite(current)) {
      return current;
    }

    await this.cacheManager.set(EVENTS_LIST_VERSION_KEY, 1, this.versionTtlMs);
    return 1;
  }

  private async bumpListVersion(): Promise<void> {
    const nextVersion = (await this.getListVersion()) + 1;
    await this.cacheManager.set(
      EVENTS_LIST_VERSION_KEY,
      nextVersion,
      this.versionTtlMs,
    );
  }

  // ─── Response Metadata ──────────────────────────────────────────────────────
  // Every response includes cache metadata so API consumers can observe caching behavior
  // (useful for debugging, monitoring hit rates, and understanding data freshness).

  private createCacheMeta(key: string, hit: boolean, ttlMs: number) {
    return {
      strategy: 'cache-aside' as const,
      key,
      hit,
      ttlMs,
    };
  }

  private toInsertPayload(dto: CreateEventDto) {
    return {
      ...dto,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
    };
  }

  private toUpdatePayload(dto: UpdateEventDto) {
    return {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    };
  }
}
