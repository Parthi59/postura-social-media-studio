import type { PlatformAdapter, PublishInput, PublishReceipt } from "./types.js";

export class MastodonAdapter implements PlatformAdapter {
  platform = "mastodon";

  constructor(
    private baseUrl = (process.env.MASTODON_BASE_URL ?? "").replace(/\/+$/, ""),
    private accessToken = process.env.MASTODON_ACCESS_TOKEN ?? ""
  ) {}

  isConfigured() {
    return Boolean(this.baseUrl && this.accessToken);
  }

  async publish(input: PublishInput): Promise<PublishReceipt> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        httpStatus: 503,
        latencyMs: 0,
        errorMessage: "Mastodon is not configured."
      };
    }

    const started = Date.now();

    const body = new URLSearchParams();
    body.set("status", input.content);

    const response = await fetch(`${this.baseUrl}/api/v1/statuses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey
      },
      body
    });

    const latencyMs = Date.now() - started;

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        latencyMs,
        errorMessage:
          payload?.error ??
          payload?.error_description ??
          `Mastodon returned HTTP ${response.status}`
      };
    }

    return {
      ok: true,
      externalId: payload?.id ? String(payload.id) : undefined,
      externalUrl: payload?.url ? String(payload.url) : undefined,
      httpStatus: response.status,
      latencyMs
    };
  }
}
