import { count, eq, inArray } from "drizzle-orm";
import type { Database } from "@repo/db";
import {
  event,
  goal,
  impression,
  integration,
  member,
  organization,
  site,
  subscription,
  user as userTable,
} from "@repo/db/schema";
import type { ProfileResponse, UpdateProfileInput } from "@repo/contracts/profile";

export class ProfileNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "ProfileNotFoundError";
  }
}

export function createProfileService(db: Pick<Database, "update" | "select">) {
  return { updateProfile, exportAccount };
  async function updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<ProfileResponse> {
    const [user] = await db
      .update(userTable)
      .set({
        ...(input.image !== undefined ? { image: input.image } : {}),
        name: input.name,
      })
      .where(eq(userTable.id, userId))
      .returning({
        createdAt: userTable.createdAt,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        id: userTable.id,
        image: userTable.image,
        name: userTable.name,
        role: userTable.role,
        updatedAt: userTable.updatedAt,
      });

    if (!user) {
      throw new ProfileNotFoundError();
    }

    return {
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  // Account-level data export (NFR-PRIV-03): everything tied to the user's
  // organizations, with integration secrets/credentials stripped.
  async function exportAccount(userId: string) {
    const [profile] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!profile) throw new ProfileNotFoundError();

    const memberships = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, userId));
    const organizationIds = memberships.map((row) => row.organizationId);
    const organizations = organizationIds.length
      ? await db
          .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            createdAt: organization.createdAt,
          })
          .from(organization)
          .where(inArray(organization.id, organizationIds))
      : [];
    const sites = organizationIds.length
      ? await db
          .select({
            id: site.id,
            organizationId: site.organizationId,
            name: site.name,
            domain: site.domain,
            createdAt: site.createdAt,
          })
          .from(site)
          .where(inArray(site.organizationId, organizationIds))
      : [];
    const siteIds = sites.map((row) => row.id);
    const events = siteIds.length
      ? await db.select().from(event).where(inArray(event.siteId, siteIds))
      : [];
    const goals = siteIds.length
      ? await db.select().from(goal).where(inArray(goal.siteId, siteIds))
      : [];
    const integrations = organizationIds.length
      ? await db
          .select()
          .from(integration)
          .where(inArray(integration.organizationId, organizationIds))
      : [];
    const subscriptions = organizationIds.length
      ? await db
          .select()
          .from(subscription)
          .where(inArray(subscription.organizationId, organizationIds))
      : [];
    const analytics = siteIds.length
      ? await db
          .select({ siteId: impression.siteId, kind: impression.kind, count: count() })
          .from(impression)
          .where(inArray(impression.siteId, siteIds))
          .groupBy(impression.siteId, impression.kind)
      : [];

    return {
      exportedAt: new Date().toISOString(),
      profile: { ...profile, createdAt: profile.createdAt.toISOString() },
      memberships,
      organizations,
      sites,
      events,
      goals,
      integrations: integrations.map(({ config, ...row }) => {
        const publicConfig = { ...((config ?? {}) as Record<string, unknown>) };
        delete publicConfig.credentials;
        delete publicConfig.secret;
        return { ...row, config: publicConfig };
      }),
      subscriptions,
      analytics,
    };
  }
}
