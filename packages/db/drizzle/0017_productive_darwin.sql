CREATE TABLE "spin_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"notification_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"prize_label" text NOT NULL,
	"prize_code" text,
	"prize_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spin_claim" ADD CONSTRAINT "spin_claim_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_claim" ADD CONSTRAINT "spin_claim_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spin_claim_notification_visitor_key" ON "spin_claim" USING btree ("notification_id","visitor_id");--> statement-breakpoint
CREATE INDEX "spin_claim_site_idx" ON "spin_claim" USING btree ("site_id");