export type CampaignStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED";

export type Platform =
  | "discord"
  | "mastodon";

export interface Campaign {
  id: string;
  title: string;
  source?: string;
  status: CampaignStatus;
  contentVersion?: number;
  approvedVersion?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  publications?: Publication[];
}

export interface CampaignVariant {
  id: string;
  campaignId: string;
  platform: Platform;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Publication {
  id: string;
  campaignId: string;
  platform: Platform;
  status: string;
  externalId?: string | null;
  externalUrl?: string | null;
  idempotencyKey?: string | null;
  httpStatus?: number | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  attemptCount?: number;
  retryAfterMs?: number | null;
  createdAt?: string;
}

export interface Connection {
  platform: Platform;
  connected: boolean;
  label?: string;
}

export interface ActivityEvent {
  id: string;
  type?: string;
  message?: string;
  campaignId?: string | null;
  createdAt: string;
}

export interface ReviewQueueItem extends Campaign {
  unresolvedCurrentVersion?: number;
  readyForApproval?: boolean;
  readyForPublish?: boolean;
}

export interface AiRisk {
  area: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

export interface AiAnalysis {
  readiness: "READY" | "NEEDS_REVIEW" | "BLOCKED";
  summary: string;
  risks: AiRisk[];
  suggestions?: string[];
  nextActions: string[];
}

export interface AiInsight {
  id: string;
  campaignId: string;
  analysis: AiAnalysis;
  createdAt?: string;
}
