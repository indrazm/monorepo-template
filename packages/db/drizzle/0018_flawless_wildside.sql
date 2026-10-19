ALTER TABLE "event" DROP CONSTRAINT "event_dedupe_key_unique";--> statement-breakpoint
ALTER TABLE "impression" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "event_site_dedupe_key" ON "event" USING btree ("site_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "impression_site_ref_kind_dedupe_key" ON "impression" USING btree ("site_id","ref_id","kind","dedupe_key");