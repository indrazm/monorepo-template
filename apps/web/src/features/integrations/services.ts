import type {
  CreateIntegrationInput,
  Integration,
  UpdateIntegrationInput,
  VerifyIntegrationResponse,
} from "@repo/contracts/integrations";
import { apiClient } from "../../api";

const integrations = apiClient.api.v1.integrations;

export async function listIntegrations(): Promise<Integration[]> {
  const response = await integrations.$get();
  if (!response.ok) throw new Error("Failed to load integrations.");
  return (await response.json()).integrations;
}

export async function createIntegration(input: CreateIntegrationInput): Promise<Integration> {
  const response = await integrations.$post({ json: input });
  if (!response.ok) throw new Error("Failed to create integration.");
  return (await response.json()).integration;
}

// Each wizard step patches part of the connection (secret, credentials, site,
// events, field mapping).
export async function updateIntegration(input: {
  id: string;
  patch: UpdateIntegrationInput;
}): Promise<Integration> {
  const response = await integrations[":id"].$patch({
    param: { id: input.id },
    json: input.patch,
  });
  if (!response.ok) throw new Error("Failed to save the integration.");
  return (await response.json()).integration;
}

// Test connection: calls the provider (or reports delivery history).
export async function verifyIntegration(id: string): Promise<VerifyIntegrationResponse> {
  const response = await integrations[":id"].verify.$post({ param: { id } });
  if (!response.ok) throw new Error("Failed to verify the connection.");
  return await response.json();
}

// Manager-only reveal of the signing secret; the list response only says
// whether one is set.
export async function revealIntegrationSecret(id: string): Promise<string | null> {
  const response = await integrations[":id"].secret.$get({ param: { id } });
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) throw new Error("Failed to reveal the signing secret.");
  return (await response.json()).secret;
}

export async function deleteIntegration(id: string): Promise<void> {
  const response = await integrations[":id"].$delete({ param: { id } });
  if (!response.ok) throw new Error("Failed to remove integration.");
}
