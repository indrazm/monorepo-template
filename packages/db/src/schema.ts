import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .$onUpdate(() => new Date()),
    role: text("role"),
    banned: boolean("banned"),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires", { precision: 3 }),
  },
  (table) => [uniqueIndex("User_email_key").on(table.email)],
);

export const session = pgTable(
  "Session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull(),
    impersonatedBy: text("impersonatedBy"),
    activeOrganizationId: text("activeOrganizationId"),
  },
  (table) => [
    uniqueIndex("Session_token_key").on(table.token),
    foreignKey({
      name: "Session_userId_fkey",
      columns: [table.userId],
      foreignColumns: [user.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const account = pgTable(
  "Account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { precision: 3 }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { precision: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "Account_userId_fkey",
      columns: [table.userId],
      foreignColumns: [user.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const verification = pgTable("Verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
  createdAt: timestamp("createdAt", { precision: 3 }).defaultNow(),
  updatedAt: timestamp("updatedAt", { precision: 3 }).$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Better Auth organization plugin (tenancy). Column names match the plugin's
// field names; the plugin resolves each model by the export key below.
// ---------------------------------------------------------------------------
export const organization = pgTable("Organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
});

export const member = pgTable(
  "Member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    userId: text("userId").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "Member_organizationId_fkey",
      columns: [table.organizationId],
      foreignColumns: [organization.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: "Member_userId_fkey",
      columns: [table.userId],
      foreignColumns: [user.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const invitation = pgTable(
  "Invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull(),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    inviterId: text("inviterId").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "Invitation_organizationId_fkey",
      columns: [table.organizationId],
      foreignColumns: [organization.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      name: "Invitation_inviterId_fkey",
      columns: [table.inviterId],
      foreignColumns: [user.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// ---------------------------------------------------------------------------
// Tacto domain
//
// Auth + tenancy tables (User/Session/Account/Verification above, plus the
// Better Auth organization-plugin tables added in F13) are owned by Better
// Auth. Every domain table below is scoped to a tenant via `organizationId`
// (= Better Auth organization id) and/or `siteId`. The shape of each `jsonb`
// column is the single source of truth in `@repo/contracts`; the database
// keeps it free-form on purpose (see SRS section 5).
// ---------------------------------------------------------------------------

// ---------- ENUMS (F4) ----------
export const planEnum = pgEnum("plan", ["free", "starter", "growth", "agency"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "recent_sales",
  "counter",
  "live_visitors",
  "review",
  "custom",
  "combo",
  "social_counter",
  "youtube",
  "low_stock",
  "countdown",
  "popup",
  "bar",
  "spin_to_win",
]);
export const eventTypeEnum = pgEnum("event_type", [
  "purchase",
  "signup",
  "visit",
  "form_submit",
  "custom",
  "review",
]);
export const formPageKindEnum = pgEnum("form_page_kind", [
  "rating",
  "negative_feedback",
  "welcome",
  "question",
  "consent",
  "about_you",
  "about_company",
  "thank_you",
]);
export const testimonialStatusEnum = pgEnum("testimonial_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
]);
// "board" is the Tacto "Testimonial Board" asset (renamed from Wall of Love).
export const assetKindEnum = pgEnum("asset_kind", [
  "board",
  "widget",
  "image",
  "video",
  "case_study",
  "rich_snippet",
]);

// ---------- FOUNDATION (F5) ----------
export const site = pgTable(
  "site",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    siteKey: text("site_key")
      .notNull()
      .unique()
      .$defaultFn(() => createId()),
    // Secret key for server-to-server ingestion (never exposed in the pixel).
    apiKey: text("api_key")
      .notNull()
      .unique()
      .$defaultFn(() => createId()),
    pixelVerifiedAt: timestamp("pixel_verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("site_org_idx").on(t.organizationId)],
);

export const subscription = pgTable("subscription", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id").notNull().unique(),
  plan: planEnum("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  trafficQuota: integer("traffic_quota").notNull().default(2000),
  provider: text("provider"),
  // Provider-side customer id (e.g. Stripe `cus_...`) for the billing portal.
  externalCustomerId: text("external_customer_id"),
  renewsAt: timestamp("renews_at"),
});

export const integration = pgTable(
  "integration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),
    provider: text("provider").notNull(),
    config: jsonb("config").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("integration_org_idx").on(t.organizationId)],
);

// ---------- NOTIFICATION ENGINE (F6) ----------
export const notification = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Untitled notification"),
    type: notificationTypeEnum("type").notNull(),
    message: jsonb("message").notNull(),
    style: jsonb("style").notNull(),
    display: jsonb("display").notNull(),
    dataSource: jsonb("data_source").notNull(),
    timing: jsonb("timing").notNull(),
    verified: boolean("verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    // Type-specific extras (countdown target, low-stock number).
    extra: jsonb("extra"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notification_site_idx").on(t.siteId)],
);

export const domainSetting = pgTable("domain_setting", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .unique()
    .references(() => site.id, { onDelete: "cascade" }),
  loop: jsonb("loop").notNull(),
  customCss: text("custom_css"),
  privacy: jsonb("privacy").notNull(),
  analyticsPassthrough: jsonb("analytics_passthrough"),
});

export const event = pgTable(
  "event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    type: eventTypeEnum("type").notNull(),
    source: text("source").notNull(),
    verified: boolean("verified").notNull().default(false),
    displayName: text("display_name"),
    city: text("city"),
    payload: jsonb("payload"),
    dedupeKey: text("dedupe_key").unique(),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("event_site_occurred_idx").on(t.siteId, t.occurredAt)],
);

// ---------- TESTIMONIAL ENGINE (F7) ----------
export const testimonialForm = pgTable("testimonial_form", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => site.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  design: jsonb("design").notNull(),
  reward: jsonb("reward"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const formPage = pgTable(
  "form_page",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    formId: text("form_id")
      .notNull()
      .references(() => testimonialForm.id, { onDelete: "cascade" }),
    kind: formPageKindEnum("kind").notNull(),
    order: integer("order").notNull(),
    config: jsonb("config").notNull(),
  },
  (t) => [index("form_page_form_idx").on(t.formId)],
);

export const testimonial = pgTable(
  "testimonial",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    formId: text("form_id").references(() => testimonialForm.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    authorPhoto: text("author_photo"),
    role: text("role"),
    company: text("company"),
    rating: integer("rating"),
    text: text("text").notNull(),
    videoUrl: text("video_url"),
    isPrivateFeedback: boolean("is_private_feedback").notNull().default(false),
    consentGiven: boolean("consent_given").notNull().default(false),
    status: testimonialStatusEnum("status").notNull().default("pending"),
    tags: text("tags").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("testimonial_site_status_idx").on(t.siteId, t.status)],
);

export const asset = pgTable("asset", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => site.id, { onDelete: "cascade" }),
  kind: assetKindEnum("kind").notNull(),
  config: jsonb("config").notNull(),
  publicSlug: text("public_slug").unique(),
});

// ---------- SHARED ----------
export const impression = pgTable(
  "impression",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    refId: text("ref_id").notNull(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    // A/B variant id, when the notification is running a variant test (FR-ANL-04).
    variant: text("variant"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("impression_site_created_idx").on(t.siteId, t.createdAt)],
);

// Conversion goals (FR-ANL-03). `rule` is a URL match (see @repo/contracts).
export const goal = pgTable(
  "goal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rule: jsonb("rule").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("goal_site_idx").on(t.siteId)],
);
