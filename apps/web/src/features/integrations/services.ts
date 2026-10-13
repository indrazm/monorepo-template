import type { CreateIntegrationInput, Integration } from "@repo/contracts/integrations";
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

export async function deleteIntegration(id: string): Promise<void> {
  const response = await integrations[":id"].$delete({ param: { id } });
  if (!response.ok) throw new Error("Failed to remove integration.");
}
