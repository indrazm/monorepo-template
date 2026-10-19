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
    // Better Auth two-factor plugin (feedback T12): set once the user enrolls.
    twoFactorEnabled: boolean("twoFactorEnabled").default(false),
  },
  (table) => [uniqueIndex("User_email_key").on(table.email)],
);

// Better Auth two-factor plugin table (feedback T12). Column names match the
// plugin's field names; the plugin resolves the model by the `twoFactor`
// export key below.
export const twoFactor = pgTable(
  "TwoFactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backupCodes").notNull(),
    userId: text("userId").notNull(),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failedVerificationCount").default(0),
    lockedUntil: timestamp("lockedUntil", { precision: 3 }),
  },
  (table) => [
    index("TwoFactor_userId_idx").on(table.userId),
    foreignKey({
      name: "TwoFactor_userId_fkey",
      columns: [table.userId],
      foreignColumns: [user.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
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
    index("Session_userId_idx").on(table.userId),
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
    index("Account_userId_idx").on(table.userId),
  ],
);

export const verification = pgTable(
  "Verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).$onUpdate(() => new Date()),
  },
  (table) => [index("Verification_identifier_idx").on(table.identifier)],
);

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
    uniqueIndex("Member_organizationId_userId_key").on(table.organizationId, table.userId),
    index("Member_userId_idx").on(table.userId),
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
  "custom",
  "combo",
  "social_counter",
  "youtube",
  "review",
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
  // Stripe: the subscription is scheduled to cancel at the period end.
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
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
    // Lifecycle (FR-INT-04): pending | connected | error | disabled.
    status: text("status").notNull().default("pending"),
    // Connection health, written by "Verify" and by inbound deliveries.
    lastCheckedAt: timestamp("last_checked_at"),
    lastEventAt: timestamp("last_event_at"),
    lastError: text("last_error"),
    // Provider-side id of the webhook Tacto registered, so disconnect can
    // revoke it (e.g. Stripe `we_...`, Shopify webhook id, Calendly uri).
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("integration_org_idx").on(t.organizationId),
    index("integration_org_provider_idx").on(t.organizationId, t.provider),
  ],
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
  (t) => [
    index("notification_site_idx").on(t.siteId),
    index("notification_site_active_idx").on(t.siteId, t.isActive),
  ],
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
  // Custom JS runs inside a sandboxed, cross-origin iframe in the pixel
  // (FR-NGS-04) — it can never touch the host page's DOM or cookies.
  customJs: text("custom_js"),
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
    // Idempotency key is scoped to the site: two tenants may both use order
    // "123" without suppressing each other's events.
    dedupeKey: text("dedupe_key"),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("event_site_occurred_idx").on(t.siteId, t.occurredAt),
    index("event_site_type_occurred_idx").on(t.siteId, t.type, t.occurredAt),
    uniqueIndex("event_site_dedupe_key").on(t.siteId, t.dedupeKey),
  ],
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
    // Audience dimensions for the analytics breakdown (FR-ANL-02), derived at
    // record time from the request (UA → device/browser, edge header → country,
    // beacon → page path). Nullable: older rows and server-to-server paths omit
    // them. `isBot` lets the dashboard exclude crawler traffic by default.
    device: text("device"),
    browser: text("browser"),
    country: text("country"),
    path: text("path"),
    isBot: boolean("is_bot").notNull().default(false),
    // Idempotency for goal conversions: the source event id/dedupe key. Null
    // for ordinary views/clicks and URL-goal conversions (Postgres allows
    // multiple nulls in a unique index).
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("impression_site_created_idx").on(t.siteId, t.createdAt),
    index("impression_site_kind_created_idx").on(t.siteId, t.kind, t.createdAt),
    index("impression_site_ref_kind_created_idx").on(t.siteId, t.refId, t.kind, t.createdAt),
    uniqueIndex("impression_site_ref_kind_dedupe_key").on(t.siteId, t.refId, t.kind, t.dedupeKey),
  ],
);

// Provider webhook deliveries already applied. Used for replay/idempotency on
// billing events (and available to integration ingest when a provider supplies
// an event id). Scoped by provider so Stripe and Paddle ids cannot collide.
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("webhook_event_provider_event_key").on(t.provider, t.eventId),
    index("webhook_event_received_idx").on(t.receivedAt),
  ],
);

// Spin-to-win rewards are drawn and stored server-side so coupon codes never
// reach the public payload and each visitor can claim exactly one reward.
export const spinClaim = pgTable(
  "spin_claim",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    prizeLabel: text("prize_label").notNull(),
    prizeCode: text("prize_code"),
    prizeUrl: text("prize_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("spin_claim_notification_visitor_key").on(t.notificationId, t.visitorId),
    index("spin_claim_site_idx").on(t.siteId),
  ],
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
