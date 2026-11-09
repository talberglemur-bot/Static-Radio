import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  real,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('listener'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

const tz = (name: string) => timestamp(name, { withTimezone: true })

export const channel = pgTable('channel', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  frequency: text('frequency').notNull(),
  description: text('description').notNull().default(''),
  ticker: text('ticker').notNull().default(''),
  currentTrackId: integer('current_track_id'),
  startedAt: tz('started_at'),
  pausedAt: tz('paused_at'),
  musicVolume: real('music_volume').notNull().default(1),
  autoDj: boolean('auto_dj').notNull().default(true),
  isLive: boolean('is_live').notNull().default(false),
  liveHost: text('live_host'),
  liveUpdatedAt: tz('live_updated_at'),
  liveMode: text('live_mode').notNull().default('duck'),
  adBreakUntil: tz('ad_break_until'),
  relayUrl: text('relay_url'),
  moveToSlug: text('move_to_slug'),
  moveAt: tz('move_at'),
  closedAt: tz('closed_at'),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const relayStation = pgTable('relay_station', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  src: text('src').notNull(),
  sort: integer('sort').notNull().default(0),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const track = pgTable('track', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull().default('Unknown artist'),
  pathname: text('pathname').notNull(),
  access: text('access').notNull().default('private'),
  durationSec: real('duration_sec').notNull(),
  kind: text('kind').notNull().default('music'),
  userId: text('user_id').notNull(),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const queueItem = pgTable('queue_item', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  trackId: integer('track_id').notNull(),
  priority: integer('priority').notNull().default(0),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const liveChunk = pgTable('live_chunk', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  pathname: text('pathname').notNull(),
  access: text('access').notNull().default('private'),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const sfxEvent = pgTable('sfx_event', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  kind: text('kind').notNull(),
  trackId: integer('track_id'),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const chatMessage = pgTable('chat_message', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  body: text('body').notNull(),
  isStaff: boolean('is_staff').notNull().default(false),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const songRequest = pgTable('song_request', {
  id: serial('id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  body: text('body').notNull(),
  artist: text('artist'),
  title: text('title'),
  trackId: integer('track_id'),
  status: text('status').notNull().default('pending'),
  createdAt: tz('created_at').notNull().defaultNow(),
})

export const listenerPresence = pgTable('listener_presence', {
  listenerId: text('listener_id').primaryKey(),
  channelId: integer('channel_id').notNull(),
  userId: text('user_id'),
  userName: text('user_name'),
  lastSeen: tz('last_seen').notNull().defaultNow(),
})
