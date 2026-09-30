import { api } from "./client";
import type {
  Campaign,
  ReviewQueueItem,
} from "../types";

export interface ReviewNote {
  id: string;
  campaignId: string;
  version: number;
  message: string;
  resolved: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const data = await api<ReviewQueueItem[]>("/api/review-queue");
  return Array.isArray(data) ? data : [];
}

export async function getReviewNotes(
  campaignId: string
): Promise<ReviewNote[]> {
  const data = await api<ReviewNote[]>(
    `/api/campaigns/${campaignId}/review-notes`
  );

  return Array.isArray(data) ? data : [];
}

export async function resolveReviewNote(
  campaignId: string,
  noteId: string
): Promise<ReviewNote> {
  return api<ReviewNote>(
    `/api/campaigns/${campaignId}/review-notes/${noteId}/resolve`,
    {
      method: "POST",
    }
  );
}

export async function reopenReviewNote(
  campaignId: string,
  noteId: string
): Promise<ReviewNote> {
  return api<ReviewNote>(
    `/api/campaigns/${campaignId}/review-notes/${noteId}/reopen`,
    {
      method: "POST",
    }
  );
}

export async function approveCampaign(
  campaignId: string
): Promise<Campaign> {
  return api<Campaign>(
    `/api/campaigns/${campaignId}/approve`,
    {
      method: "POST",
    }
  );
}