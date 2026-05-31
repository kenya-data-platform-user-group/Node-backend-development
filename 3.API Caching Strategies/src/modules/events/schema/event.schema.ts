import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 180 }).notNull().unique(),
  description: text('description'),
  location: varchar('location', { length: 160 }).notNull(),
  organizer: varchar('organizer', { length: 120 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  capacity: integer('capacity'),
  isVirtual: boolean('is_virtual').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
