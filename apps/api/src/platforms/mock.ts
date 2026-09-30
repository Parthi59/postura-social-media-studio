import crypto from "node:crypto";
import type {
  PublishReceipt,
  PublishRequest,
  SocialPublisher
} from "./publisher.js";

export type MockPublishMode = "success" | "rate_limit" | "server_error";

/**
 * Internal capstone adapter used to exercise the publisher seam without
 * pretending to be a real social network.
 *
 * Production destinations remain Discord and Mastodon. This adapter is kept
 * separate from the production publisher registry and UI.
 */
export class MockPlatformAdapter implements SocialPublisher {
  private readonly receipts = new Map<string, PublishReceipt>();

  constructor(
    public readonly platform: string,
    private mode: MockPublishMode = "success"
  ) {}

  isConfigured() {
    return true;
  }

  setMode(mode: MockPublishMode) {
    this.mode = mode;
  }

  async publish(input: PublishRequest): Promise<PublishReceipt> {
    const existing = this.receipts.get(input.idempotencyKey);
    if (existing) return existing;

    const started = Date.now();

    if (this.mode === "rate_limit") {
      const receipt: PublishReceipt = {
        ok: false,
        httpStatus: 429,
        latencyMs: Date.now() - started,
        retryAfterMs: 2000,
        errorMessage: `${this.platform} simulated rate limit.`
      };

      this.receipts.set(input.idempotencyKey, receipt);
      return receipt;
    }

    if (this.mode === "server_error") {
      const receipt: PublishReceipt = {
        ok: false,
        httpStatus: 503,
        latencyMs: Date.now() - started,
        errorMessage: `${this.platform} simulated service failure.`
      };

      this.receipts.set(input.idempotencyKey, receipt);
      return receipt;
    }

    const externalId = `mock_${crypto.randomUUID()}`;
    const receipt: PublishReceipt = {
      ok: true,
      httpStatus: 201,
      latencyMs: Date.now() - started,
      externalId,
      externalUrl: `mock://${this.platform}/${externalId}`
    };

    this.receipts.set(input.idempotencyKey, receipt);
    return receipt;
  }
}
