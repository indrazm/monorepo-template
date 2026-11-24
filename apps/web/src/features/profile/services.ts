import { updateCurrentUserProfile, type UpdateProfileInput } from "@repo/api-client";
import { apiClient } from "../../lib/api";

export function updateProfile(input: UpdateProfileInput) {
  return updateCurrentUserProfile(apiClient, input);
}
