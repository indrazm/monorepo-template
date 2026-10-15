import { hc } from "hono/client";
import type { AppType } from "@repo/api/types";
import type { InferRequestType, InferResponseType } from "hono/client";
import { profileResponseSchema } from "@repo/contracts/profile";

export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl, {
    init: {
      credentials: "include",
      // Bypass the ngrok dev-tunnel interstitial so a public test URL works from
      // the browser too; ignored by any other host (SRS NFR-REL-02).
      headers: { "ngrok-skip-browser-warning": "true" },
    },
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

export type UpdateProfileInput = InferRequestType<ApiClient["profile"]["$patch"]>["json"];
export type SessionUser = InferResponseType<ApiClient["session"]["$get"], 200>["user"];

export class UnauthorizedApiError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedApiError";
  }
}

export async function fetchSessionUser(client: ApiClient) {
  const response = await client.session.$get();

  if (response.status === 401) {
    throw new UnauthorizedApiError();
  }

  if (!response.ok) {
    throw new Error("Failed to load current user.");
  }

  const data = await response.json();

  return data.user;
}

export async function updateCurrentUserProfile(client: ApiClient, input: UpdateProfileInput) {
  const response = await client.profile.$patch({
    json: input,
  });

  if (response.status === 401) {
    throw new UnauthorizedApiError();
  }

  if (!response.ok) {
    throw new Error("Failed to update profile.");
  }

  const data = profileResponseSchema.parse(await response.json());

  return data.user;
}
