-- The Review feature was removed from the product. Purge any rows that still
-- reference it before the enum no longer knows the value.
DELETE FROM "notification" WHERE "type" = 'review';--> statement-breakpoint
DELETE FROM "event" WHERE "type" = 'review';--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."event_type";--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('purchase', 'signup', 'visit', 'form_submit', 'custom');--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "type" SET DATA TYPE "public"."event_type" USING "type"::"public"."event_type";--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('recent_sales', 'counter', 'live_visitors', 'custom', 'combo', 'social_counter', 'youtube', 'low_stock', 'countdown', 'popup', 'bar', 'spin_to_win');--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";
