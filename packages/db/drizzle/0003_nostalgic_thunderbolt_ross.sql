ALTER TABLE "site" ADD COLUMN "api_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_api_key_unique" UNIQUE("api_key");