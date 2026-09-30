import type { PlatformAdapter, PublishInput, PublishReceipt } from "./types.js";

export type DiscordPublishReceipt = PublishReceipt & {
  retryAfterMs?: number;
};

function parseRetryAfterMs(response: Response, body: any): number | undefined {
  const header = response.headers.get("retry-after");
  if (header) {
    const numeric = Number(header);
    if (Number.isFinite(numeric)) {
      // Discord may return seconds in the Retry-After header.
      return Math.max(0, Math.round(numeric * 1000));
    }
  }

  if (typeof body?.retry_after === "number" && Number.isFinite(body.retry_after)) {
    return Math.max(0, Math.round(body.retry_after * 1000));
  }

  return undefined;
}

export class DiscordAdapter implements PlatformAdapter {
  platform = "discord";

  constructor(private webhookUrl = process.env.DISCORD_WEBHOOK_URL ?? "") {}

  isConfigured() {
    return Boolean(this.webhookUrl);
  }

  async publish(input: PublishInput): Promise<DiscordPublishReceipt> {
    if (!this.webhookUrl) {
      return {
        ok: false,
        httpStatus: 503,
        latencyMs: 0,
        errorMessage: "Discord is not configured."
      };
    }

    const started = Date.now();

    const response = await fetch(`${this.webhookUrl}?wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Postura-Idempotency-Key": input.idempotencyKey
      },
      body: JSON.stringify({
        content: input.content,
        allowed_mentions: { parse: [] }
      })
    });

    const latencyMs = Date.now() - started;

    let body: any = null;
    try {
      body = await response.json();
    } catch {}

    const retryAfterMs = parseRetryAfterMs(response, body);

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        latencyMs,
        retryAfterMs,
        errorMessage: body?.message ?? `Discord returned HTTP ${response.status}`
      };
    }

    const externalId = body?.id ? String(body.id) : undefined;
    const channelId = body?.channel_id ? String(body.channel_id) : undefined;
    const guildId = body?.guild_id ? String(body.guild_id) : undefined;

    const externalUrl =
      externalId && channelId && guildId
        ? `https://discord.com/channels/${guildId}/${channelId}/${externalId}`
        : undefined;

    return {
      ok: true,
      externalId,
      externalUrl,
      httpStatus: response.status,
      latencyMs
    };
  }
}
