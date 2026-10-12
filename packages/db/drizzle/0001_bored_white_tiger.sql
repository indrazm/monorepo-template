CREATE TYPE "public"."asset_kind" AS ENUM('board', 'widget', 'image', 'video', 'case_study', 'rich_snippet');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('purchase', 'signup', 'visit', 'form_submit', 'custom');--> statement-breakpoint
CREATE TYPE "public"."form_page_kind" AS ENUM('rating', 'negative_feedback', 'welcome', 'question', 'consent', 'about_you', 'about_company', 'thank_you');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('recent_sales', 'counter', 'live_visitors', 'review', 'custom', 'combo', 'social_counter', 'youtube', 'low_stock', 'countdown');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'growth', 'agency');--> statement-breakpoint
CREATE TYPE "public"."testimonial_status" AS ENUM('pending', 'approved', 'rejected', 'hidden');--> statement-breakpoint
CREATE TABLE "asset" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"config" jsonb NOT NULL,
	"public_slug" text,
	CONSTRAINT "asset_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "domain_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"loop" jsonb NOT NULL,
	"custom_css" text,
	"privacy" jsonb NOT NULL,
	"analytics_passthrough" jsonb,
	CONSTRAINT "domain_setting_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"source" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"display_name" text,
	"city" text,
	"payload" jsonb,
	"dedupe_key" text,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "form_page" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"kind" "form_page_kind" NOT NULL,
	"order" integer NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impression" (
	"id" text PRIMARY KEY NOT NULL,
	"ref_id" text NOT NULL,
	"site_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"config" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text DEFAULT 'Untitled notification' NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" jsonb NOT NULL,
	"style" jsonb NOT NULL,
	"display" jsonb NOT NULL,
	"data_source" jsonb NOT NULL,
	"timing" jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"site_key" text NOT NULL,
	"pixel_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_site_key_unique" UNIQUE("site_key")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"traffic_quota" integer DEFAULT 2000 NOT NULL,
	"provider" text,
	"renews_at" timestamp,
	CONSTRAINT "subscription_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"form_id" text,
	"author_name" text NOT NULL,
	"author_photo" text,
	"role" text,
	"company" text,
	"rating" integer,
	"text" text NOT NULL,
	"video_url" text,
	"is_private_feedback" boolean DEFAULT false NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"status" "testimonial_status" DEFAULT 'pending' NOT NULL,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonial_form" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"design" jsonb NOT NULL,
	"reward" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "testimonial_form_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_setting" ADD CONSTRAINT "domain_setting_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_page" ADD CONSTRAINT "form_page_form_id_testimonial_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."testimonial_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impression" ADD CONSTRAINT "impression_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_form_id_testimonial_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."testimonial_form"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial_form" ADD CONSTRAINT "testimonial_form_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_site_occurred_idx" ON "event" USING btree ("site_id","occurred_at");--> statement-breakpoint
CREATE INDEX "form_page_form_idx" ON "form_page" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "impression_site_created_idx" ON "impression" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "integration_org_idx" ON "integration" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notification_site_idx" ON "notification" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_org_idx" ON "site" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "testimonial_site_status_idx" ON "testimonial" USING btree ("site_id","status");