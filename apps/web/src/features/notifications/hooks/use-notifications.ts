import type { UpdateNotificationInput } from "@repo/contracts/notifications";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createNotification,
  deleteNotification,
  listNotifications,
  updateNotification,
} from "../services";

export const notificationsKey = (siteId: string) => ["notifications", siteId] as const;

export function notificationsQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: notificationsKey(siteId),
    queryFn: () => listNotifications(siteId),
    enabled: siteId.length > 0,
  });
}

export function useCreateNotificationMutation(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey(siteId) }),
  });
}

export function useUpdateNotificationMutation(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNotificationInput }) =>
      updateNotification(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey(siteId) }),
  });
}

export function useDeleteNotificationMutation(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey(siteId) }),
  });
}
