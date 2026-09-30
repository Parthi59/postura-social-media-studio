import { api } from "./client";
import type {
  Campaign,
  CampaignVariant,
  Publication,
} from "../types";

export async function getCampaigns(): Promise<Campaign[]> {
  const data = await api<Campaign[]>("/api/campaigns");
  return Array.isArray(data) ? data : [];
}

export async function getCampaign(
  campaignId: string
): Promise<Campaign> {
  return api<Campaign>(`/api/campaigns/${campaignId}`);
}

export async function createCampaign(input: {
  title: string;
  source: string;
}): Promise<Campaign> {
  return api<Campaign>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCampaignVariants(
  campaignId: string
): Promise<CampaignVariant[]> {
  const response = await api<{
    campaignId: string;
    source: string;
    variants: CampaignVariant[];
  }>(`/api/campaigns/${campaignId}/variants`);

  return Array.isArray(response.variants)
    ? response.variants
    : [];
}

export async function getCampaignPublications(
  campaignId: string
): Promise<Publication[]> {
  const campaign = await getCampaign(campaignId);

  return Array.isArray(campaign.publications)
    ? campaign.publications
    : [];
}