ALTER TABLE "integration" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "last_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "last_event_at" timestamp;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "external_ref" text;--> statement-breakpoint
-- Existing rows used a single 'active' status; the lifecycle (FR-INT-04) replaces
-- it with pending | connected | error | disabled.
UPDATE "integration" SET "status" = 'connected' WHERE "status" = 'active';
