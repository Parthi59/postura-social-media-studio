import { api } from "./api";

export type PosturaPlatform = "discord" | "mastodon";

export const posturaBackend = {
  health: () => api("/api/health"),
  constraintProfiles: () => api("/api/constraint-profiles"),
  connections: () => api("/api/connections"),

  campaigns: () => api("/api/campaigns"),
  createCampaign: (payload: { title: string; source: string; sourceType?: "markdown" | "url"; sourceUrl?: string }) =>
    api("/api/campaigns", { method: "POST", body: JSON.stringify(payload) }),
  ingestMarkdown: (title: string, markdown: string) =>
    api("/api/posts/ingest", { method: "POST", body: JSON.stringify({ title, markdown }) }),
  ingestUrl: (title: string, url: string) =>
    api("/api/posts/ingest", { method: "POST", body: JSON.stringify({ title, url }) }),

  revisions: (campaignId: string) => api(`/api/campaigns/${campaignId}/revisions`),
  restoreRevision: (campaignId: string, version: number) =>
    api(`/api/campaigns/${campaignId}/revisions/${version}/restore`, { method: "POST" }),

  variants: (campaignId: string) => api(`/api/campaigns/${campaignId}/variants`),
  updateVariant: (campaignId: string, platform: PosturaPlatform, content: string) =>
    api(`/api/campaigns/${campaignId}/variants`, {
      method: "PUT",
      body: JSON.stringify({ platform, content })
    }),
  updateChannelContent: (campaignId: string, discord: string, mastodon: string) =>
    api(`/api/campaigns/${campaignId}/channel-content`, {
      method: "PUT",
      body: JSON.stringify({ discord, mastodon })
    }),

  submitReview: (campaignId: string) =>
    api(`/api/campaigns/${campaignId}/submit-review`, { method: "POST" }),
  approve: (campaignId: string) =>
    api(`/api/campaigns/${campaignId}/approve`, { method: "POST" }),
  reopenCampaign: (campaignId: string) =>
    api(`/api/campaigns/${campaignId}/reopen`, { method: "POST" }),
  reviewQueue: () => api("/api/review-queue"),

  comments: (campaignId: string) => api(`/api/campaigns/${campaignId}/comments`),
  addComment: (campaignId: string, payload: { version: number; author: string; message: string }) =>
    api(`/api/campaigns/${campaignId}/comments`, { method: "POST", body: JSON.stringify(payload) }),
  resolveComment: (commentId: string) => api(`/api/comments/${commentId}/resolve`, { method: "POST" }),
  reopenComment: (commentId: string) => api(`/api/comments/${commentId}/reopen`, { method: "POST" }),

  aiInsights: (campaignId: string) => api(`/api/campaigns/${campaignId}/ai/insights`),
  analyzeCampaign: (campaignId: string) => api(`/api/campaigns/${campaignId}/ai/analyze`, { method: "POST" }),

  publications: () => api("/api/publications"),
  schedules: () => api("/api/schedules"),
  createSchedule: (payload: { campaignId: string; platform: PosturaPlatform; scheduledAt: string }) =>
    api("/api/schedules", { method: "POST", body: JSON.stringify(payload) }),
  cancelSchedule: (scheduleId: string) => api(`/api/schedules/${scheduleId}/cancel`, { method: "POST" }),

  activity: () => api("/api/activity"),
  preflight: (campaignId: string, platforms: PosturaPlatform[]) =>
    api(`/api/campaigns/${campaignId}/preflight`, { method: "POST", body: JSON.stringify({ platforms }) }),
  publishMany: (campaignId: string, platforms: PosturaPlatform[]) =>
    api(`/api/campaigns/${campaignId}/publish`, { method: "POST", body: JSON.stringify({ platforms }) }),
  publishPlatform: (campaignId: string, platform: PosturaPlatform, idempotencyKey = crypto.randomUUID()) =>
    api(`/api/campaigns/${campaignId}/publish/${platform}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey }
    }),
  publishDefault: (campaignId: string, idempotencyKey = crypto.randomUUID()) =>
    api(`/api/campaigns/${campaignId}/publish-default`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey }
    })
};

