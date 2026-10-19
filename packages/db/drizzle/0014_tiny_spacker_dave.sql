ALTER TABLE "impression" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "impression" ADD COLUMN "browser" text;--> statement-breakpoint
ALTER TABLE "impression" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "impression" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "impression" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;