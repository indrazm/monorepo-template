import type {
  CreateNotificationInput,
  Notification,
  UpdateNotificationInput,
} from "@repo/contracts/notifications";
import { apiClient } from "../../api";

const notifications = apiClient.api.v1.notifications;

export async function listNotifications(siteId: string): Promise<Notification[]> {
  const response = await notifications.$get({ query: { siteId } });
  if (!response.ok) throw new Error("Failed to load notifications.");
  const data = await response.json();
  return data.notifications;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const response = await notifications.$post({ json: input });
  if (!response.ok) throw new Error("Failed to create notification.");
  const data = await response.json();
  return data.notification;
}

export async function updateNotification(
  id: string,
  input: UpdateNotificationInput,
): Promise<Notification> {
  const response = await notifications[":id"].$patch({ param: { id }, json: input });
  if (!response.ok) throw new Error("Failed to update notification.");
  const data = await response.json();
  return data.notification;
}

export async function deleteNotification(id: string): Promise<void> {
  const response = await notifications[":id"].$delete({ param: { id } });
  if (!response.ok) throw new Error("Failed to delete notification.");
}
