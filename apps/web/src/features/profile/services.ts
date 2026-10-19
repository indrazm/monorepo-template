import { updateCurrentUserProfile, type UpdateProfileInput } from "@repo/api-client";
import { apiClient } from "../../api";

export function updateProfile(input: UpdateProfileInput) {
  return updateCurrentUserProfile(apiClient, input);
}

export async function exportAccountData(): Promise<unknown> {
  const response = await apiClient.profile.export.$get();
  if (!response.ok) throw new Error("Could not export your data.");
  return response.json();
}
