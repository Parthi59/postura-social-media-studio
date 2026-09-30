import { api } from "./client";
import type {
  Platform,
  Publication,
} from "../types";

export interface Schedule {
  id: string;
  campaignId: string;
  platform: Platform;
  scheduledAt: string;
  status: string;
  executedAt?: string | null;
  publicationId?: string | null;
  errorMessage?: string | null;
}

export async function getSchedules(): Promise<Schedule[]> {
  const data = await api<Schedule[]>("/api/schedules");

  return Array.isArray(data) ? data : [];
}

export async function publishCampaign(
  campaignId: string,
  platform: Platform,
  idempotencyKey?: string
): Promise<Publication> {
  return api<Publication>(
    `/api/campaigns/${campaignId}/publish/${platform}`,
    {
      method: "POST",
      headers: idempotencyKey
        ? {
            "Idempotency-Key": idempotencyKey,
          }
        : undefined,
    }
  );
}

export async function publishWithDefaultAdapter(
  campaignId: string,
  idempotencyKey?: string
): Promise<{
  adapter: string;
  publication: Publication;
}> {
  return api(
    `/api/campaigns/${campaignId}/publish-default`,
    {
      method: "POST",
      headers: idempotencyKey
        ? {
            "Idempotency-Key": idempotencyKey,
          }
        : undefined,
    }
  );
}