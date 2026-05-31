import { z } from 'zod';
import { eventCategories, eventStatuses } from './create-event.dto';

export const eventSortFields = [
  'createdAt',
  'updatedAt',
  'startsAt',
  'title',
  'category',
  'status',
] as const;

export const listEventsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(eventSortFields).default('startsAt'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().trim().min(1).max(100).optional(),
    category: z.enum(eventCategories).optional(),
    status: z.enum(eventStatuses).optional(),
    isVirtual: z.coerce.boolean().optional(),
    upcoming: z.coerce.boolean().default(false),
  })
  .strict();

export type ListEventsDto = z.infer<typeof listEventsSchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CacheMeta {
  strategy: 'cache-aside';
  key: string;
  hit: boolean;
  ttlMs: number;
}

export interface CachedCollectionResponse<T> {
  data: T[];
  meta: PaginationMeta;
  cache: CacheMeta;
}

export interface CachedItemResponse<T> {
  data: T;
  cache: CacheMeta;
}
