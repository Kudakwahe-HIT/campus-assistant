import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/* ---------- Enums ---------- */

// 'unknown' = has not yet told the bot who they are.
// 'student' / 'staff' stay unverified (verifiedAt is null) until Phase 2 verification.
export const userRole = pgEnum('user_role', ['unknown', 'prospect', 'student', 'staff']);
export const tonePref = pgEnum('tone_pref', ['neutral', 'social', 'professional']);
export const contentCategory = pgEnum('content_category', [
  'admissions',
  'fees',
  'registration',
  'accommodation',
  'orientation',
  'campus_life',
  'contacts',
  'general',
]);
export const ticketStatus = pgEnum('ticket_status', ['open', 'assigned', 'closed']);
export const messageDirection = pgEnum('message_direction', ['in', 'out']);

/* ---------- Academic structure ---------- */

export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id')
    .notNull()
    .references(() => schools.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

/* ---------- People ---------- */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // WhatsApp wa_id: digits only, with country code, e.g. 2637XXXXXXXX
    phone: text('phone').notNull().unique(),
    name: text('name'),
    role: userRole('role').notNull().default('unknown'),
    studentNumber: text('student_number').unique(),
    schoolId: integer('school_id').references(() => schools.id),
    level: integer('level'),
    tone: tonePref('tone').notNull().default('neutral'),
    language: text('language').notNull().default('en'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    // Set when the user sends STOP; broadcasts must skip these users.
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_role_idx').on(t.role)],
);

/* ---------- Conversation ---------- */

// Per-user multi-step flow state (OTP verification, applications, etc.).
// Not used by the Phase 1 router yet; created now so Phase 2 flows have a home.
export const conversationState = pgTable('conversation_state', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  step: text('step').notNull().default('idle'),
  data: jsonb('data').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // WhatsApp message id. Unique so redelivered webhooks are processed once.
    waMessageId: text('wa_message_id').unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    direction: messageDirection('direction').notNull(),
    kind: text('kind').notNull(),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_user_created_idx').on(t.userId, t.createdAt)],
);

/* ---------- Knowledge base (edited from the back office) ---------- */

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: contentCategory('category').notNull(),
    title: text('title').notNull(),
    keywords: text('keywords')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    body: text('body').notNull(),
    // Every answer has an owner and a review date so nothing goes stale silently.
    ownerName: text('owner_name'),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('content_category_idx').on(t.category, t.isPublished)],
);

// Questions the bot could not answer: reviewed weekly to find content gaps.
export const unansweredQuestions = pgTable('unanswered_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedContentId: uuid('resolved_content_id').references(() => contentItems.id, {
    onDelete: 'set null',
  }),
});

/* ---------- Human handoff ---------- */

export const handoffTickets = pgTable(
  'handoff_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: ticketStatus('status').notNull().default('open'),
    note: text('note'),
    assignedTo: text('assigned_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [index('tickets_status_idx').on(t.status)],
);

/* ---------- Consent (used by alerts in Phase 2) ---------- */

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(), // e.g. 'events', 'exams', 'faith', 'marketplace_listing'
    granted: boolean('granted').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('consents_user_topic_idx').on(t.userId, t.topic)],
);

/* ---------- Types ---------- */

export type User = typeof users.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
