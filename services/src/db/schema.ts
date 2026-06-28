import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const apiKey = pgTable('api_key', {
  id: uuid('id').defaultRandom().primaryKey(),

  user_id: text('user_id').notNull(),
  prefix: text('prefix').notNull(),
  value: text('value').notNull(),

  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  last_used_at: timestamp('last_used_at', { withTimezone: true }),

  revoked_at: timestamp('revoked_at', { withTimezone: true }),
});

export const playlist = pgTable('playlist', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  limit: integer('playlist_limit').notNull(),
  totalVideo: integer('total_videos').default(0),
  created_at: timestamp('created_at', { withTimezone: true })
});
