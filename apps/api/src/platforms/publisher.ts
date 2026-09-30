export type PublishRequest = {
  content: string;
  idempotencyKey: string;
};

export type PublishReceipt = {
  ok: boolean;
  httpStatus: number;
  latencyMs: number;
  externalId?: string | null;
  externalUrl?: string | null;
  errorMessage?: string | null;
  retryAfterMs?: number | null;
};

export interface SocialPublisher {
  isConfigured(): boolean;
  publish(input: PublishRequest): Promise<PublishReceipt>;
}
