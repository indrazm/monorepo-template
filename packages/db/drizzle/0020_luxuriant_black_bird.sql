CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "event_site_type_occurred_idx" ON "event" USING btree ("site_id","type","occurred_at");--> statement-breakpoint
CREATE INDEX "impression_site_kind_created_idx" ON "impression" USING btree ("site_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "impression_site_ref_kind_created_idx" ON "impression" USING btree ("site_id","ref_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "integration_org_provider_idx" ON "integration" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "Member_organizationId_userId_key" ON "Member" USING btree ("organizationId","userId");--> statement-breakpoint
CREATE INDEX "Member_userId_idx" ON "Member" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "notification_site_active_idx" ON "notification" USING btree ("site_id","is_active");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Verification_identifier_idx" ON "Verification" USING btree ("identifier");