import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { notification, site } from "@repo/db/schema";
import type {
  CreateNotificationInput,
  Notification,
  NotificationConfig,
  UpdateNotificationInput,
} from "@repo/contracts/notifications";

type NotificationRow = typeof notification.$inferSelect;

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    type: row.type,
    verified: row.verified,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    config: {
      message: row.message,
      style: row.style,
      display: row.display,
      dataSource: row.dataSource,
      timing: row.timing,
    } as NotificationConfig,
  };
}

export function createNotificationsService(
  db: Pick<Database, "select" | "insert" | "update" | "delete">,
) {
  return { list, get, create, update, remove };

  // Guard: the site must belong to the organization before we touch its data.
  async function assertSiteInOrg(organizationId: string, siteId: string): Promise<boolean> {
    const rows = await db
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    return rows.length > 0;
  }

  async function list(organizationId: string, siteId: string): Promise<Notification[] | null> {
    if (!(await assertSiteInOrg(organizationId, siteId))) return null;
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.siteId, siteId))
      .orderBy(desc(notification.createdAt));
    return rows.map(toNotification);
  }

  async function get(organizationId: string, id: string): Promise<Notification | null> {
    const rows = await db
      .select({ notification })
      .from(notification)
      .innerJoin(site, eq(notification.siteId, site.id))
      .where(and(eq(notification.id, id), eq(site.organizationId, organizationId)))
      .limit(1);
    return rows[0] ? toNotification(rows[0].notification) : null;
  }

  async function create(
    organizationId: string,
    input: CreateNotificationInput,
  ): Promise<Notification | null> {
    if (!(await assertSiteInOrg(organizationId, input.siteId))) return null;
    const [row] = await db
      .insert(notification)
      .values({
        siteId: input.siteId,
        name: input.name,
        type: input.type,
        isActive: input.isActive,
        message: input.config.message,
        style: input.config.style,
        display: input.config.display,
        dataSource: input.config.dataSource,
        timing: input.config.timing,
      })
      .returning();
    if (!row) throw new Error("Failed to create notification.");
    return toNotification(row);
  }

  async function update(
    organizationId: string,
    id: string,
    input: UpdateNotificationInput,
  ): Promise<Notification | null> {
    // Ensure the notification is in the org (via its site) before updating.
    const existing = await get(organizationId, id);
    if (!existing) return null;
    const values: Partial<NotificationRow> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.type !== undefined) values.type = input.type;
    if (input.isActive !== undefined) values.isActive = input.isActive;
    if (input.config?.message !== undefined) values.message = input.config.message;
    if (input.config?.style !== undefined) values.style = input.config.style;
    if (input.config?.display !== undefined) values.display = input.config.display;
    if (input.config?.dataSource !== undefined) values.dataSource = input.config.dataSource;
    if (input.config?.timing !== undefined) values.timing = input.config.timing;
    const [row] = await db
      .update(notification)
      .set(values)
      .where(eq(notification.id, id))
      .returning();
    return row ? toNotification(row) : null;
  }

  async function remove(organizationId: string, id: string): Promise<boolean> {
    const existing = await get(organizationId, id);
    if (!existing) return false;
    await db.delete(notification).where(eq(notification.id, id));
    return true;
  }
}
