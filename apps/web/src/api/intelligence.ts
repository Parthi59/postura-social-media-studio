import { api } from "./client";
import type { AiInsight } from "../types";

export async function getCampaignInsights(
  campaignId: string
): Promise<AiInsight[]> {
  const data = await api<AiInsight[]>(
    `/api/campaigns/${campaignId}/ai/insights`
  );

  return Array.isArray(data) ? data : [];
}

export async function runCampaignBrain(
  campaignId: string
): Promise<AiInsight> {
  return api<AiInsight>(
    `/api/campaigns/${campaignId}/ai/analyze`,
    {
      method: "POST",
    }
  );
}