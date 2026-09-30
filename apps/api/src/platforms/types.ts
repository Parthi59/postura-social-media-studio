export type PublishInput = {
  content: string;
  idempotencyKey: string;
};

export type PublishReceipt = {
  ok: boolean;
  externalId?: string;
  externalUrl?: string;
  httpStatus: number;
  latencyMs: number;
  errorMessage?: string;
};

export interface PlatformAdapter {
  platform: string;
  isConfigured(): boolean;
  publish(input: PublishInput): Promise<PublishReceipt>;
}
