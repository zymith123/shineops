import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// "admin" is a platform operator: belongs to no company and manages all of them.
export const roleEnum = pgEnum("role", ["owner", "manager", "cleaner", "client", "admin"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "paused", "cancelled"]);
export const frequencyEnum = pgEnum("frequency", ["weekly", "biweekly", "monthly"]);
export const visitStatusEnum = pgEnum("visit_status", ["scheduled", "completed", "skipped", "cancelled"]);
export const feedbackSourceEnum = pgEnum("feedback_source", ["portal", "webhook", "manual"]);
export const healthStatusEnum = pgEnum("health_status", ["healthy", "at_risk", "critical"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "done"]);
export const taskSourceEnum = pgEnum("task_source", ["ai", "manual", "client_request"]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Shared secret external systems send in the X-ShineOps-Secret header.
  webhookSecret: text("webhook_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    bedrooms: integer("bedrooms").notNull().default(2),
    bathrooms: integer("bathrooms").notNull().default(1),
    pets: text("pets").notNull().default(""),
    entryNotes: text("entry_notes").notNull().default(""),
    status: clientStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("clients_company_idx").on(t.companyId),
    uniqueIndex("clients_company_email_idx").on(t.companyId, t.email),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null only for platform admins.
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    // Set only for role = client: which client record this portal login belongs to.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_company_idx").on(t.companyId),
    // Compared as text so the migration can add the enum value and this check in one transaction.
    check("users_admin_company_check", sql`(${t.role}::text = 'admin') = (${t.companyId} is null)`),
  ],
);

export const servicePlans = pgTable(
  "service_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    frequency: frequencyEnum("frequency").notNull(),
    priceCents: integer("price_cents").notNull(),
    // Cleaner the client normally gets; visits default to them.
    preferredCleanerId: uuid("preferred_cleaner_id").references(() => users.id, { onDelete: "set null" }),
    startDate: date("start_date").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("plans_client_idx").on(t.clientId)],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    cleanerId: uuid("cleaner_id").references(() => users.id, { onDelete: "set null" }),
    scheduledDate: date("scheduled_date").notNull(),
    status: visitStatusEnum("status").notNull().default("scheduled"),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("visits_company_date_idx").on(t.companyId, t.scheduledDate),
    // Makes schedule generation idempotent: one visit per client per day.
    uniqueIndex("visits_client_date_idx").on(t.clientId, t.scheduledDate),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    source: feedbackSourceEnum("source").notNull(),
    // Id from the sending system, so webhook retries don't create duplicates.
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feedback_client_idx").on(t.clientId, t.createdAt),
    uniqueIndex("feedback_external_idx").on(t.companyId, t.externalId),
  ],
);

export type HealthReason = { signal: string; detail: string };

export const healthAssessments = pgTable(
  "health_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    status: healthStatusEnum("status").notNull(),
    score: integer("score").notNull(),
    summary: text("summary").notNull(),
    reasons: jsonb("reasons").$type<HealthReason[]>().notNull(),
    recommendedAction: text("recommended_action").notNull(),
    generatedBy: text("generated_by").notNull(), // "ai" | "rules"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("health_client_idx").on(t.clientId, t.createdAt)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("open"),
    source: taskSourceEnum("source").notNull(),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("tasks_company_status_idx").on(t.companyId, t.status)],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type Frequency = (typeof frequencyEnum.enumValues)[number];
export type HealthStatus = (typeof healthStatusEnum.enumValues)[number];
