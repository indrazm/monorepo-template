import type { CreateSiteInput, DomainSetting, Site, UpdateSiteInput } from "@repo/contracts/sites";
import { apiClient } from "../../api";

const sites = apiClient.api.v1.sites;

export async function listSites(): Promise<Site[]> {
  const response = await sites.$get();
  if (!response.ok) throw new Error("Failed to load sites.");
  const data = await response.json();
  return data.sites;
}

export async function createSite(input: CreateSiteInput): Promise<Site> {
  const response = await sites.$post({ json: input });
  if (!response.ok) throw new Error("Failed to create site.");
  const data = await response.json();
  return data.site;
}

export async function updateSite(id: string, input: UpdateSiteInput): Promise<Site> {
  const response = await sites[":id"].$patch({ param: { id }, json: input });
  if (!response.ok) throw new Error("Failed to update site.");
  const data = await response.json();
  return data.site;
}

export async function deleteSite(id: string): Promise<void> {
  const response = await sites[":id"].$delete({ param: { id } });
  if (!response.ok) throw new Error("Failed to delete site.");
}

export async function getSiteSettings(id: string): Promise<DomainSetting> {
  const response = await sites[":id"].settings.$get({ param: { id } });
  if (!response.ok) throw new Error("Failed to load settings.");
  return (await response.json()).settings;
}

export async function updateSiteSettings(id: string, input: DomainSetting): Promise<DomainSetting> {
  const response = await sites[":id"].settings.$put({ param: { id }, json: input });
  if (!response.ok) throw new Error("Failed to save settings.");
  return (await response.json()).settings;
}
