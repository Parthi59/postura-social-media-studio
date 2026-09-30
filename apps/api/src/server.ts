import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "./db.js";
import { DiscordAdapter } from "./platforms/discord.js";
import { MastodonAdapter } from "./platforms/mastodon.js";
import {
  CONSTRAINT_PROFILES,
  validatePlatformContent,
  type PlatformKey
} from "./constraints.js";

type PublishRequest = {
  content: string;
  idempotencyKey: string;
};

type PublishReceipt = {
  ok: boolean;
  httpStatus: number;
  latencyMs: number;
  externalId?: string | null;
  externalUrl?: string | null;
  errorMessage?: string | null;
  retryAfterMs?: number | null;
};

interface SocialPublisher {
  isConfigured(): boolean;
  publish(input: PublishRequest): Promise<PublishReceipt>;
}


const app = express();
const port = Number(process.env.PORT ?? 4000);
const origin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin }));
app.use(express.json({ limit: "1mb" }));

const discord = new DiscordAdapter();
const mastodon = new MastodonAdapter();

const publishers: Record<PlatformKey, SocialPublisher> = {
  discord,
  mastodon
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


const cleanEnvValue = (value?: string) =>
  (value ?? "")
    .trim()
    .replace(/^\\?["']+/, "")
    .replace(/\\?["']+$/, "")
    .trim();

const configuredDefaultPublisher = cleanEnvValue(
  process.env.POSTURA_DEFAULT_PUBLISHER
) as PlatformKey;

const defaultPublisher: PlatformKey =
  configuredDefaultPublisher &&
  configuredDefaultPublisher in publishers
    ? configuredDefaultPublisher
    : "discord";

console.log(`[Postura] default publisher: ${defaultPublisher}`);

const groqApiKey = cleanEnvValue(process.env.GROQ_API_KEY);

const configuredGroqModel = cleanEnvValue(process.env.GROQ_MODEL);

const groqModel =
  !configuredGroqModel ||
  configuredGroqModel === "llama-3.3-70b-versatile"
    ? "openai/gpt-oss-120b"
    : configuredGroqModel;

console.log(`[Postura Intelligence] Groq model: ${groqModel}`);

function groqIsConfigured() {
  return Boolean(groqApiKey);
}

function stripJsonFences(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

const aiAnalysisSchema = z.object({
  summary: z.string().min(1),
  readiness: z.enum(["READY", "NEEDS_REVIEW", "BLOCKED"]),
  risks: z.array(
    z.object({
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
      area: z.string().min(1),
      message: z.string().min(1)
    })
  ),
  platforms: z.object({
    discord: z.object({
      assessment: z.string().min(1),
      suggestedCopy: z.string(),
      reasons: z.array(z.string())
    }),
    mastodon: z.object({
      assessment: z.string().min(1),
      suggestedCopy: z.string(),
      reasons: z.array(z.string())
    })
  }),
  nextActions: z.array(z.string())
});

async function analyzeCampaignWithGroq(input: {
  title: string;
  source: string;
  status: string;
  contentVersion: number;
  approvedVersion: number | null;
  discordContent: string;
  mastodonContent: string;
  unresolvedReviewNotes: Array<{ message: string; version: number }>;
}) {
  if (!groqIsConfigured()) {
    throw new Error(
      "Postura Intelligence is not configured. Add GROQ_API_KEY to apps/api/.env."
    );
  }

  const systemPrompt = `
You are Postura Intelligence, an AI campaign operations layer inside a real social media publishing studio.

Your job is NOT to act like a generic chatbot or invent marketing facts.
Analyze the supplied campaign state and help a human reviewer make a publishing decision.

Rules:
- Use only facts present in the supplied campaign data.
- Never invent claims, statistics, product capabilities, dates, offers, or links.
- Preserve the campaign's intent.
- Discord copy may be conversational and community-oriented.
- Mastodon copy must be concise and should stay within 500 characters.
- Treat unresolved reviewer notes as blockers or risks when relevant.
- If current content is already strong, do not rewrite merely for novelty.
- Suggested copy must remain faithful to the source.
- AI suggestions are proposals only; the human decides whether to apply them.

Return ONLY valid JSON using this exact shape:
{
  "summary": "short operational assessment",
  "readiness": "READY | NEEDS_REVIEW | BLOCKED",
  "risks": [
    {
      "severity": "LOW | MEDIUM | HIGH",
      "area": "short category",
      "message": "specific issue"
    }
  ],
  "platforms": {
    "discord": {
      "assessment": "specific assessment",
      "suggestedCopy": "suggested final Discord copy",
      "reasons": ["reason 1", "reason 2"]
    },
    "mastodon": {
      "assessment": "specific assessment",
      "suggestedCopy": "suggested final Mastodon copy",
      "reasons": ["reason 1", "reason 2"]
    }
  },
  "nextActions": ["specific next action"]
}
`.trim();

  const userPrompt = JSON.stringify(input, null, 2);

  const started = Date.now();

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    }
  );

  const latencyMs = Date.now() - started;
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Groq request failed (${response.status}): ${raw.slice(0, 300)}`
    );
  }

  const envelope = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = envelope.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(stripJsonFences(content));
  } catch {
    throw new Error("Postura Intelligence returned invalid JSON.");
  }

  const parsed = aiAnalysisSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new Error("Postura Intelligence returned an unexpected response shape.");
  }

  return {
    analysis: parsed.data,
    latencyMs,
    provider: "groq",
    model: groqModel
  };
}


async function snapshotCampaignRevision(
  campaignId: string,
  reason: string,
  forcedVersion?: number
) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const variants = await db.campaignVariant.findMany({
    where: { campaignId }
  });

  const discordContent =
    variants.find(item => item.platform === "discord")?.content ??
    campaign.source;

  const mastodonContent =
    variants.find(item => item.platform === "mastodon")?.content ??
    campaign.source;

  const version = forcedVersion ?? campaign.contentVersion;

  await db.campaignRevision.upsert({
    where: {
      campaignId_version: {
        campaignId,
        version
      }
    },
    create: {
      campaignId,
      version,
      discordContent,
      mastodonContent,
      reason
    },
    update: {
      discordContent,
      mastodonContent,
      reason
    }
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "postura-api" });
});

app.get("/api/constraint-profiles", (_req, res) => {
  res.json(Object.values(CONSTRAINT_PROFILES));
});


app.get("/api/connections", (_req, res) => {
  res.json([
    {
      platform: "discord",
      label: "Discord",
      connected: discord.isConfigured(),
      mode: "live"
    },
    {
      platform: "mastodon",
      label: "Mastodon",
      connected: mastodon.isConfigured(),
      mode: "live"
    }
  ]);
});

app.get("/api/campaigns", async (_req, res) => {
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { publications: true }
  });

  res.json(campaigns);
});



app.get("/api/campaigns/:id/revisions", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const revisions = await db.campaignRevision.findMany({
    where: { campaignId: campaign.id },
    orderBy: { version: "desc" }
  });

  res.json({
    campaignId: campaign.id,
    currentVersion: campaign.contentVersion,
    approvedVersion: campaign.approvedVersion,
    revisions
  });
});

app.post("/api/campaigns/:id/revisions/:version/restore", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const version = Number(req.params.version);

  if (!Number.isInteger(version) || version < 1) {
    return res.status(400).json({ error: "Invalid version." });
  }

  const revision = await db.campaignRevision.findUnique({
    where: {
      campaignId_version: {
        campaignId: campaign.id,
        version
      }
    }
  });

  if (!revision) {
    return res.status(404).json({ error: "Revision not found." });
  }

  await db.campaignVariant.upsert({
    where: {
      campaignId_platform: {
        campaignId: campaign.id,
        platform: "discord"
      }
    },
    create: {
      campaignId: campaign.id,
      platform: "discord",
      content: revision.discordContent
    },
    update: {
      content: revision.discordContent
    }
  });

  await db.campaignVariant.upsert({
    where: {
      campaignId_platform: {
        campaignId: campaign.id,
        platform: "mastodon"
      }
    },
    create: {
      campaignId: campaign.id,
      platform: "mastodon",
      content: revision.mastodonContent
    },
    update: {
      content: revision.mastodonContent
    }
  });

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "DRAFT",
      approvedVersion: null,
      contentVersion: {
        increment: 1
      }
    }
  });

  await snapshotCampaignRevision(
    campaign.id,
    `Restored from version ${revision.version}`,
    updated.contentVersion
  );

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "revision.restored",
      message: `Campaign restored from version ${revision.version}`,
      metadata: JSON.stringify({
        restoredFromVersion: revision.version,
        newVersion: updated.contentVersion
      })
    }
  });

  res.json({
    campaign: updated,
    restoredFrom: revision.version
  });
});

app.get("/api/campaigns/:id/variants", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const variants = await db.campaignVariant.findMany({
    where: { campaignId: campaign.id }
  });

  res.json({
    campaignId: campaign.id,
    source: campaign.source,
    variants
  });
});


const channelContentSchema = z.object({
  discord: z.string().trim().min(1).max(2000),
  mastodon: z.string().trim().min(1).max(500)
});

app.put("/api/campaigns/:id/channel-content", async (req, res) => {
  const parsed = channelContentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const discordValidation = validatePlatformContent(
    "discord",
    parsed.data.discord
  );
  const mastodonValidation = validatePlatformContent(
    "mastodon",
    parsed.data.mastodon
  );

  if (!discordValidation.valid || !mastodonValidation.valid) {
    return res.status(400).json({
      error: "Platform constraint validation failed.",
      checks: {
        discord: discordValidation,
        mastodon: mastodonValidation
      }
    });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const existingVariants = await db.campaignVariant.findMany({
    where: { campaignId: campaign.id }
  });

  const currentDiscord =
    existingVariants.find(item => item.platform === "discord")?.content ??
    campaign.source;

  const currentMastodon =
    existingVariants.find(item => item.platform === "mastodon")?.content ??
    campaign.source;

  const discordChanged = currentDiscord !== parsed.data.discord;
  const mastodonChanged = currentMastodon !== parsed.data.mastodon;

  if (!discordChanged && !mastodonChanged) {
    return res.json({
      changed: false,
      campaign,
      message: "No channel content changes detected."
    });
  }

  const updatedCampaign = await db.$transaction(async tx => {
    await tx.campaignVariant.upsert({
      where: {
        campaignId_platform: {
          campaignId: campaign.id,
          platform: "discord"
        }
      },
      create: {
        campaignId: campaign.id,
        platform: "discord",
        content: parsed.data.discord
      },
      update: {
        content: parsed.data.discord
      }
    });

    await tx.campaignVariant.upsert({
      where: {
        campaignId_platform: {
          campaignId: campaign.id,
          platform: "mastodon"
        }
      },
      create: {
        campaignId: campaign.id,
        platform: "mastodon",
        content: parsed.data.mastodon
      },
      update: {
        content: parsed.data.mastodon
      }
    });

    return tx.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "DRAFT",
        approvedVersion: null,
        contentVersion: {
          increment: 1
        }
      }
    });
  });

  const changedPlatforms = [
    discordChanged ? "discord" : null,
    mastodonChanged ? "mastodon" : null
  ].filter(Boolean);

  await snapshotCampaignRevision(
    campaign.id,
    `Channel content updated (${changedPlatforms.join(" + ")})`,
    updatedCampaign.contentVersion
  );

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "channel_content.updated",
      message: "Channel content updated",
      metadata: JSON.stringify({
        version: updatedCampaign.contentVersion,
        changedPlatforms
      })
    }
  });

  res.json({
    changed: true,
    campaign: updatedCampaign,
    changedPlatforms
  });
});

const platformSchema = z.enum([
  "discord",
  "mastodon"
]);

const variantSchema = z.object({
  platform: platformSchema,
  content: z.string().trim().min(1).max(5000)
});

app.put("/api/campaigns/:id/variants", async (req, res) => {
  const parsed = variantSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const validation = validatePlatformContent(
    parsed.data.platform,
    parsed.data.content
  );

  if (!validation.valid) {
    return res.status(400).json({
      error: "Platform constraint validation failed.",
      platform: parsed.data.platform,
      violations: validation.violations
    });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const variant = await db.campaignVariant.upsert({
    where: {
      campaignId_platform: {
        campaignId: campaign.id,
        platform: parsed.data.platform
      }
    },
    create: {
      campaignId: campaign.id,
      platform: parsed.data.platform,
      content: parsed.data.content
    },
    update: {
      content: parsed.data.content
    }
  });

  const versionedCampaign = await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "DRAFT",
      approvedVersion: null,
      contentVersion: {
        increment: 1
      }
    }
  });

  await snapshotCampaignRevision(
    campaign.id,
    `${parsed.data.platform} content updated`,
    versionedCampaign.contentVersion
  );

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "variant.updated",
      message: `${parsed.data.platform} content updated`,
      metadata: JSON.stringify({
        platform: parsed.data.platform,
        variantId: variant.id
      })
    }
  });

  res.json(variant);
});

app.get("/api/publications", async (_req, res) => {
  const publications = await db.publication.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  res.json(publications);
});

app.get("/api/schedules", async (_req, res) => {
  const schedules = await db.schedule.findMany({
    orderBy: { scheduledAt: "asc" },
    include: {
      campaign: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  res.json(schedules);
});

const campaignSchema = z.object({
  title: z.string().trim().min(2).max(120),
  source: z.string().trim().min(1).max(12000)
});


function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInitialVariant(platform: PlatformKey, source: string) {
  const clean = source.replace(/\s+/g, " ").trim();

  if (platform === "mastodon") {
    return clean.slice(0, CONSTRAINT_PROFILES.mastodon.maxLength);
  }

  return clean.slice(0, CONSTRAINT_PROFILES[platform].maxLength);
}

const ingestSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    markdown: z.string().trim().min(1).max(12000).optional(),
    url: z.string().url().optional()
  })
  .refine(value => Boolean(value.markdown) !== Boolean(value.url), {
    message: "Provide exactly one source: markdown or url."
  });

app.post("/api/posts/ingest", async (req, res) => {
  const parsed = ingestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  let source = parsed.data.markdown ?? "";
  let sourceType = "markdown";
  let sourceUrl: string | null = null;

  if (parsed.data.url) {
    sourceType = "url";
    sourceUrl = parsed.data.url;

    try {
      const response = await fetch(parsed.data.url, {
        headers: {
          "User-Agent": "Postura-Capstone/1.0"
        }
      });

      if (!response.ok) {
        return res.status(422).json({
          error: `Source URL fetch failed with HTTP ${response.status}.`
        });
      }

      source = stripHtmlToText(await response.text()).slice(0, 12000);
    } catch (error) {
      return res.status(422).json({
        error:
          error instanceof Error
            ? `Source URL fetch failed: ${error.message}`
            : "Source URL fetch failed."
      });
    }
  }

  if (!source.trim()) {
    return res.status(422).json({
      error: "The ingested source is empty."
    });
  }

  const campaign = await db.campaign.create({
    data: {
      title: parsed.data.title,
      source,
      variants: {
        create: (
          ["discord", "mastodon"] as PlatformKey[]
        ).map(platform => ({
          platform,
          content: buildInitialVariant(platform, source)
        }))
      },
      events: {
        create: {
          type: "source.ingested",
          message: `Source ingested from ${sourceType}`
        }
      }
    }
  });

  await snapshotCampaignRevision(campaign.id, "Source ingested", 1);

  const variants = await db.campaignVariant.findMany({
    where: { campaignId: campaign.id }
  });

  return res.status(201).json({
    campaign,
    sourceOfTruth: {
      type: sourceType,
      url: sourceUrl,
      characters: source.length
    },
    variants
  });
});

app.post("/api/campaigns", async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await db.campaign.create({
    data: {
      title: parsed.data.title,
      source: parsed.data.source,
      events: {
        create: {
          type: "campaign.created",
          message: "Campaign created"
        }
      }
    }
  });

  await snapshotCampaignRevision(campaign.id, "Campaign created", 1);

  res.status(201).json(campaign);
});


app.post("/api/campaigns/:id/submit-review", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  if (!["DRAFT", "PUBLISHED"].includes(campaign.status)) {
    return res.status(400).json({
      error: `Campaign cannot enter review from ${campaign.status}.`
    });
  }

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: { status: "IN_REVIEW" }
  });

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "approval.submitted",
      message: "Campaign submitted for review"
    }
  });

  res.json(updated);
});

app.post("/api/campaigns/:id/approve", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  if (campaign.status !== "IN_REVIEW") {
    return res.status(400).json({
      error: "Only campaigns in review can be approved."
    });
  }

  const unresolvedCount = await db.reviewComment.count({
    where: {
      campaignId: campaign.id,
      version: campaign.contentVersion,
      resolved: false
    }
  });

  if (unresolvedCount > 0) {
    return res.status(409).json({
      error: `Resolve ${unresolvedCount} review note${unresolvedCount === 1 ? "" : "s"} on version ${campaign.contentVersion} before approval.`
    });
  }

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "APPROVED",
      approvedVersion: campaign.contentVersion
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "approval.approved",
      message: "Campaign approved for publishing"
    }
  });

  res.json(updated);
});

app.post("/api/campaigns/:id/reopen", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  if (!["IN_REVIEW", "APPROVED", "PUBLISHED"].includes(campaign.status)) {
    return res.status(400).json({
      error: `Campaign cannot be reopened from ${campaign.status}.`
    });
  }

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "DRAFT",
      approvedVersion: null
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "approval.reopened",
      message: "Campaign reopened as draft"
    }
  });

  res.json(updated);
});

const scheduleSchema = z.object({
  campaignId: z.string().min(1),
  platform: platformSchema.default("discord"),
  scheduledAt: z.string().datetime()
});

app.post("/api/schedules", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: parsed.data.campaignId }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);

  if (scheduledAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: "Scheduled time must be in the future." });
  }

  const approvalValid =
    campaign.approvedVersion != null &&
    campaign.approvedVersion === campaign.contentVersion &&
    ["APPROVED", "PUBLISHED"].includes(campaign.status);

  if (!approvalValid) {
    return res.status(409).json({
      error: "Only the currently approved campaign version can be scheduled."
    });
  }

  const platform = parsed.data.platform;
  const publisher = publishers[platform];

  if (!publisher.isConfigured()) {
    return res.status(503).json({
      error: `${platform} is not connected.`
    });
  }

  const variant = await db.campaignVariant.findUnique({
    where: {
      campaignId_platform: {
        campaignId: campaign.id,
        platform
      }
    }
  });

  const content = variant?.content ?? campaign.source;
  const validation = validatePlatformContent(platform, content);

  if (!validation.valid) {
    return res.status(422).json({
      error: "Platform constraint validation failed.",
      platform,
      violations: validation.violations
    });
  }

  const schedule = await db.schedule.create({
    data: {
      campaignId: campaign.id,
      platform,
      scheduledAt
    },
    include: {
      campaign: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "schedule.created",
      message: `${parsed.data.platform} publish scheduled for ${scheduledAt.toISOString()}`,
      metadata: JSON.stringify({
        scheduleId: schedule.id,
        platform: parsed.data.platform,
        scheduledAt: scheduledAt.toISOString()
      })
    }
  });

  res.status(201).json(schedule);
});

app.post("/api/schedules/:id/cancel", async (req, res) => {
  const schedule = await db.schedule.findUnique({
    where: { id: req.params.id }
  });

  if (!schedule) {
    return res.status(404).json({ error: "Schedule not found." });
  }

  if (schedule.status !== "SCHEDULED") {
    return res.status(400).json({ error: "Only scheduled items can be cancelled." });
  }

  const updated = await db.schedule.update({
    where: { id: schedule.id },
    data: { status: "CANCELLED" },
    include: {
      campaign: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: schedule.campaignId,
      type: "schedule.cancelled",
      message: "Scheduled Discord publication cancelled",
      metadata: JSON.stringify({ scheduleId: schedule.id })
    }
  });

  res.json(updated);
});


app.get("/api/campaigns/:id/comments", async (req, res) => {
  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const comments = await db.reviewComment.findMany({
    where: { campaignId: campaign.id },
    orderBy: [
      { version: "desc" },
      { createdAt: "desc" }
    ]
  });

  res.json({
    campaignId: campaign.id,
    currentVersion: campaign.contentVersion,
    comments
  });
});

const reviewCommentSchema = z.object({
  version: z.number().int().positive(),
  author: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(2000)
});

app.post("/api/campaigns/:id/comments", async (req, res) => {
  const parsed = reviewCommentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  if (parsed.data.version > campaign.contentVersion) {
    return res.status(400).json({ error: "Invalid campaign version." });
  }

  const comment = await db.reviewComment.create({
    data: {
      campaignId: campaign.id,
      version: parsed.data.version,
      author: parsed.data.author,
      message: parsed.data.message
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: "review.comment_added",
      message: `Review note added to version ${parsed.data.version}`,
      metadata: JSON.stringify({
        commentId: comment.id,
        version: parsed.data.version,
        author: parsed.data.author
      })
    }
  });

  res.status(201).json(comment);
});

app.post("/api/comments/:id/resolve", async (req, res) => {
  const comment = await db.reviewComment.findUnique({
    where: { id: req.params.id }
  });

  if (!comment) {
    return res.status(404).json({ error: "Review note not found." });
  }

  const updated = await db.reviewComment.update({
    where: { id: comment.id },
    data: {
      resolved: true,
      resolvedAt: new Date()
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: comment.campaignId,
      type: "review.comment_resolved",
      message: `Review note resolved on version ${comment.version}`,
      metadata: JSON.stringify({
        commentId: comment.id,
        version: comment.version
      })
    }
  });

  res.json(updated);
});

app.post("/api/comments/:id/reopen", async (req, res) => {
  const comment = await db.reviewComment.findUnique({
    where: { id: req.params.id }
  });

  if (!comment) {
    return res.status(404).json({ error: "Review note not found." });
  }

  const updated = await db.reviewComment.update({
    where: { id: comment.id },
    data: {
      resolved: false,
      resolvedAt: null
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: comment.campaignId,
      type: "review.comment_reopened",
      message: `Review note reopened on version ${comment.version}`,
      metadata: JSON.stringify({
        commentId: comment.id,
        version: comment.version
      })
    }
  });

  res.json(updated);
});



app.get("/api/campaigns/:id/ai/insights", async (req, res) => {
  try {
    const campaign = await db.campaign.findUnique({
      where: { id: req.params.id }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const insights = await db.aiInsight.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    const parsed = insights.flatMap(insight => {
      try {
        return [{
          id: insight.id,
          campaignId: insight.campaignId,
          version: insight.version,
          provider: insight.provider,
          model: insight.model,
          createdAt: insight.createdAt,
          analysis: JSON.parse(insight.payload)
        }];
      } catch {
        return [];
      }
    });

    return res.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Postura Intelligence history.";

    console.error("[Postura Intelligence] insight history failed:", error);

    const lower = message.toLowerCase();
    const isAiInsightDatabaseError =
      lower.includes("no such table") ||
      lower.includes("table `aiinsight`") ||
      lower.includes("table aiinsight") ||
      (lower.includes("prisma") && lower.includes("aiinsight"));

    return res.status(500).json({
      error: isAiInsightDatabaseError
        ? "AI database is not synced yet. Run Prisma db:push and prisma generate, then restart the API."
        : message
    });
  }
});

app.post("/api/campaigns/:id/ai/analyze", async (req, res) => {
  try {
    const campaign = await db.campaign.findUnique({
      where: { id: req.params.id }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    if (!groqIsConfigured()) {
      return res.status(503).json({
        error:
          "Postura Intelligence is not configured. Add GROQ_API_KEY to apps/api/.env and restart the API."
      });
    }

    const [variants, unresolvedComments] = await Promise.all([
      db.campaignVariant.findMany({
        where: { campaignId: campaign.id }
      }),
      db.reviewComment.findMany({
        where: {
          campaignId: campaign.id,
          version: campaign.contentVersion,
          resolved: false
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const discordContent =
      variants.find(item => item.platform === "discord")?.content ??
      campaign.source;

    const mastodonContent =
      variants.find(item => item.platform === "mastodon")?.content ??
      campaign.source;

    const result = await analyzeCampaignWithGroq({
      title: campaign.title,
      source: campaign.source,
      status: campaign.status,
      contentVersion: campaign.contentVersion,
      approvedVersion: campaign.approvedVersion ?? null,
      discordContent,
      mastodonContent,
      unresolvedReviewNotes: unresolvedComments.map(comment => ({
        message: comment.message,
        version: comment.version
      }))
    });

    const saved = await db.aiInsight.create({
      data: {
        campaignId: campaign.id,
        version: campaign.contentVersion,
        provider: result.provider,
        model: result.model,
        payload: JSON.stringify(result.analysis)
      }
    });

    await db.activityEvent.create({
      data: {
        campaignId: campaign.id,
        type: "ai.campaign_analyzed",
        message: `Postura Intelligence analyzed version ${campaign.contentVersion}`,
        metadata: JSON.stringify({
          insightId: saved.id,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          readiness: result.analysis.readiness
        })
      }
    });

    return res.status(201).json({
      id: saved.id,
      campaignId: campaign.id,
      version: campaign.contentVersion,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      createdAt: saved.createdAt,
      analysis: result.analysis
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Postura Intelligence analysis failed.";

    console.error("[Postura Intelligence] analysis failed:", error);

    const lower = message.toLowerCase();

    // Only classify actual Prisma/SQLite AiInsight-table failures as DB sync issues.
    const isAiInsightDatabaseError =
      lower.includes("no such table") ||
      lower.includes("table `aiinsight`") ||
      lower.includes("table aiinsight") ||
      lower.includes("model `aiinsight`") ||
      lower.includes("model aiinsight") ||
      lower.includes("prisma") && lower.includes("aiinsight");

    if (isAiInsightDatabaseError) {
      return res.status(500).json({
        error:
          "AI database is not synced yet. Run Prisma db:push and prisma generate, then restart the API."
      });
    }

    // Provider/configuration/model errors should surface as their real message.
    const isAiProviderError =
      lower.includes("groq") ||
      lower.includes("api key") ||
      lower.includes("unauthorized") ||
      lower.includes("invalid_api_key") ||
      lower.includes("model") ||
      lower.includes("rate limit") ||
      lower.includes("429");

    if (isAiProviderError) {
      return res.status(502).json({
        error: message
      });
    }

    return res.status(500).json({ error: message });
  }
});

app.get("/api/review-queue", async (_req, res) => {
  const campaigns = await db.campaign.findMany({
    where: {
      status: {
        in: ["IN_REVIEW", "APPROVED"]
      }
    },
    orderBy: { updatedAt: "desc" },
    include: {
      reviewComments: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const queue = campaigns.map(campaign => {
    const currentVersionComments = campaign.reviewComments.filter(
      comment => comment.version === campaign.contentVersion
    );

    const unresolvedCurrentVersion = currentVersionComments.filter(
      comment => !comment.resolved
    ).length;

    const approvalVersionMatches =
      campaign.approvedVersion != null &&
      campaign.approvedVersion === campaign.contentVersion;

    return {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      approvedVersion: campaign.approvedVersion,
      updatedAt: campaign.updatedAt,
      unresolvedCurrentVersion,
      currentVersionComments,
      approvalVersionMatches,
      readyForApproval:
        campaign.status === "IN_REVIEW" &&
        unresolvedCurrentVersion === 0,
      readyForPublish:
        campaign.status === "APPROVED" &&
        approvalVersionMatches &&
        unresolvedCurrentVersion === 0
    };
  });

  res.json(queue);
});

app.get("/api/activity", async (_req, res) => {
  const events = await db.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      campaign: {
        select: {
          title: true
        }
      }
    }
  });

  res.json(events);
});


async function getCampaignContentForPlatform(
  campaignId: string,
  platform: PlatformKey
) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const variant = await db.campaignVariant.findUnique({
    where: {
      campaignId_platform: {
        campaignId,
        platform
      }
    }
  });

  const content = variant?.content ?? campaign.source;
  const validation = validatePlatformContent(platform, content);

  if (!validation.valid) {
    throw new Error(
      `Constraint validation failed for ${platform}: ${validation.violations
        .map((item: { message: string }) => item.message)
        .join(" ")}`
    );
  }

  return { campaign, content, validation };
}

async function publishCampaignToPlatform(
  campaignId: string,
  platform: PlatformKey,
  requestedKey: string
) {
  const { campaign, content } = await getCampaignContentForPlatform(
    campaignId,
    platform
  );

  const publisher = publishers[platform];

  if (!publisher.isConfigured()) {
    throw new Error(`${platform} is not connected.`);
  }

  const idempotencyKey =
    `${platform}:${campaign.id}:v${campaign.contentVersion}:${requestedKey}`;

  let publication = await db.publication.findUnique({
    where: { idempotencyKey }
  });

  if (publication?.status === "PUBLISHED") {
    return publication;
  }

  if (!publication) {
    publication = await db.publication.create({
      data: {
        campaignId: campaign.id,
        platform,
        status: "PENDING",
        idempotencyKey,
        attemptCount: 0,
        lastAttemptAt: new Date()
      }
    });

    await db.activityEvent.create({
      data: {
        campaignId: campaign.id,
        type: "publish.started",
        message: `${platform} publish initiated`,
        metadata: JSON.stringify({
          platform,
          idempotencyKey,
          contentVersion: campaign.contentVersion
        })
      }
    });
  }

  const maxAttempts = 3;
  let finalReceipt: PublishReceipt | null = null;
  let attempt = publication.attemptCount;

  while (attempt < maxAttempts) {
    attempt += 1;

    const receipt = await publisher.publish({
      content,
      idempotencyKey
    });

    finalReceipt = receipt;

    publication = await db.publication.update({
      where: { id: publication.id },
      data: {
        attemptCount: attempt,
        httpStatus: receipt.httpStatus,
        latencyMs: receipt.latencyMs,
        externalId: receipt.externalId ?? null,
        externalUrl: receipt.externalUrl ?? null,
        errorMessage: receipt.errorMessage ?? null,
        retryAfterMs: receipt.retryAfterMs ?? null,
        lastAttemptAt: new Date()
      }
    });

    await db.activityEvent.create({
      data: {
        campaignId: campaign.id,
        type: receipt.ok
          ? "publish.attempt_succeeded"
          : "publish.attempt_failed",
        message: receipt.ok
          ? `${platform} publish attempt ${attempt} succeeded`
          : `${platform} publish attempt ${attempt} failed`,
        metadata: JSON.stringify({
          platform,
          attempt,
          httpStatus: receipt.httpStatus,
          latencyMs: receipt.latencyMs,
          retryAfterMs: receipt.retryAfterMs ?? null
        })
      }
    });

    if (receipt.ok) {
      break;
    }

    const retriable =
      receipt.httpStatus === 429 ||
      receipt.httpStatus === 408 ||
      receipt.httpStatus >= 500;

    if (!retriable || attempt >= maxAttempts) {
      break;
    }

    const delayMs =
      receipt.retryAfterMs ??
      Math.min(1000 * 2 ** (attempt - 1), 8000);

    await db.activityEvent.create({
      data: {
        campaignId: campaign.id,
        type: "publish.retry_scheduled",
        message: `${platform} retry scheduled after ${delayMs} ms`,
        metadata: JSON.stringify({
          platform,
          attempt,
          nextAttempt: attempt + 1,
          delayMs
        })
      }
    });

    await sleep(delayMs);
  }

  if (!finalReceipt) {
    throw new Error("No publish attempt was completed.");
  }

  const updatedPublication = await db.publication.update({
    where: { id: publication.id },
    data: {
      status: finalReceipt.ok ? "PUBLISHED" : "FAILED",
      externalId: finalReceipt.externalId ?? null,
      externalUrl: finalReceipt.externalUrl ?? null,
      httpStatus: finalReceipt.httpStatus,
      latencyMs: finalReceipt.latencyMs,
      errorMessage: finalReceipt.errorMessage ?? null,
      retryAfterMs: finalReceipt.retryAfterMs ?? null,
      lastAttemptAt: new Date()
    }
  });

  await db.activityEvent.create({
    data: {
      campaignId: campaign.id,
      type: finalReceipt.ok ? "publish.succeeded" : "publish.failed",
      message: finalReceipt.ok
        ? `${platform} accepted publication`
        : `${platform} publication failed`,
      metadata: JSON.stringify({
        platform,
        idempotencyKey,
        httpStatus: finalReceipt.httpStatus,
        latencyMs: finalReceipt.latencyMs,
        externalId: finalReceipt.externalId ?? null,
        attempts: updatedPublication.attemptCount
      })
    }
  });

  if (finalReceipt.ok) {
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "PUBLISHED" }
    });
  }

  return updatedPublication;
}

app.post("/api/campaigns/:id/publish/:platform", async (req, res) => {
  const parsedPlatform = platformSchema.safeParse(req.params.platform);

  if (!parsedPlatform.success) {
    return res.status(400).json({
      error: "Unknown publishing platform."
    });
  }

  try {
    const requestedKey =
      req.header("Idempotency-Key")?.trim() ||
      crypto.randomUUID();

    const publication = await publishCampaignToPlatform(
      req.params.id,
      parsedPlatform.data,
      requestedKey
    );

    return res
      .status(publication.status === "PUBLISHED" ? 201 : 502)
      .json(publication);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Publish failed.";

    return res
      .status(message === "Campaign not found." ? 404 : 500)
      .json({ error: message });
  }
});

app.post("/api/campaigns/:id/publish-default", async (req, res) => {
  try {
    const requestedKey =
      req.header("Idempotency-Key")?.trim() ||
      crypto.randomUUID();

    const publication = await publishCampaignToPlatform(
      req.params.id,
      defaultPublisher,
      requestedKey
    );

    return res
      .status(publication.status === "PUBLISHED" ? 201 : 502)
      .json({
        adapter: defaultPublisher,
        publication
      });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Publish failed."
    });
  }
});

app.post("/api/campaigns/:id/preflight", async (req, res) => {
  const bodySchema = z.object({
    platforms: z.array(platformSchema).min(1)
  });

  const parsed = bodySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const checks = [];

  for (const platform of parsed.data.platforms) {
    const { content } = await getCampaignContentForPlatform(
      campaign.id,
      platform
    );

    const connected = publishers[platform].isConfigured();
    const validation = validatePlatformContent(platform, content);

    checks.push({
      platform,
      connected,
      contentValid: validation.valid,
      length: content.length,
      maxLength: validation.profile.maxLength,
      hashtagCount: validation.hashtagCount,
      maxHashtags: validation.profile.maxHashtags,
      tone: validation.profile.tone,
      violations: validation.violations,
      ready: connected && validation.valid,
      message: !connected
        ? `${platform} is not connected.`
        : !validation.valid
        ? validation.violations.map((item: { message: string }) => item.message).join(" ")
        : "Ready to publish."
    });
  }

  const unresolvedReviewNotes = await db.reviewComment.count({
    where: {
      campaignId: campaign.id,
      version: campaign.contentVersion,
      resolved: false
    }
  });

  const approvalReady =
    campaign.approvedVersion != null &&
    campaign.approvedVersion === campaign.contentVersion &&
    unresolvedReviewNotes === 0 &&
    ["APPROVED", "PUBLISHED"].includes(campaign.status);

  res.json({
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    approvedVersion: campaign.approvedVersion,
    unresolvedReviewNotes,
    approvalReady,
    ready: approvalReady && checks.every(check => check.ready),
    checks
  });
});

app.post("/api/campaigns/:id/publish", async (req, res) => {
  const bodySchema = z.object({
    platforms: z.array(platformSchema).min(1)
  });

  const parsed = bodySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: req.params.id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found." });
  }

  const approvalValid =
    campaign.approvedVersion != null &&
    campaign.approvedVersion === campaign.contentVersion &&
    ["APPROVED", "PUBLISHED"].includes(campaign.status);

  if (!approvalValid) {
    return res.status(409).json({
      error: "Campaign content changed or is not approved. Re-approval is required."
    });
  }

  const results: Array<{
    platform: PlatformKey;
    ok: boolean;
    publication?: any;
    error?: string;
  }> = [];

  for (const platform of parsed.data.platforms) {
    const requestKey = crypto.randomUUID();

    try {
      const publication = await publishCampaignToPlatform(
        campaign.id,
        platform,
        requestKey
      );

      results.push({
        platform,
        ok: publication.status === "PUBLISHED",
        publication
      });
    } catch (error) {
      results.push({
        platform,
        ok: false,
        error: error instanceof Error ? error.message : "Publish failed."
      });
    }
  }

  const allSucceeded = results.every(result => result.ok);

  res.status(allSucceeded ? 201 : 207).json({
    campaignId: campaign.id,
    allSucceeded,
    results
  });
});

let schedulerRunning = false;

async function recoverInterruptedSchedules() {
  const recovered = await db.schedule.updateMany({
    where: {
      status: "PROCESSING",
      executedAt: null
    },
    data: {
      status: "SCHEDULED",
      errorMessage: "Recovered after worker restart."
    }
  });

  if (recovered.count > 0) {
    console.log(
      `[Postura scheduler] recovered ${recovered.count} interrupted schedule(s).`
    );
  }
}

async function runScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    const due = await db.schedule.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: new Date() }
      },
      orderBy: { scheduledAt: "asc" },
      take: 10
    });

    for (const schedule of due) {
      const claimed = await db.schedule.updateMany({
        where: {
          id: schedule.id,
          status: "SCHEDULED"
        },
        data: {
          status: "PROCESSING"
        }
      });

      if (claimed.count !== 1) continue;

      try {
        const platform = platformSchema.parse(schedule.platform);

        const campaign = await db.campaign.findUnique({
          where: { id: schedule.campaignId }
        });

        if (!campaign) {
          throw new Error("Campaign not found.");
        }

        const approvalStillValid =
          campaign.approvedVersion != null &&
          campaign.approvedVersion === campaign.contentVersion &&
          ["APPROVED", "PUBLISHED"].includes(campaign.status);

        if (!approvalStillValid) {
          throw new Error(
            `The campaign changed after scheduling or is no longer approved. Current version: v${campaign.contentVersion}.`
          );
        }

        const publication = await publishCampaignToPlatform(
          schedule.campaignId,
          platform,
          `schedule:${schedule.id}`
        );

        await db.schedule.update({
          where: { id: schedule.id },
          data: {
            status:
              publication.status === "PUBLISHED"
                ? "PUBLISHED"
                : "FAILED",
            executedAt: new Date(),
            publicationId: publication.id,
            errorMessage: publication.errorMessage
          }
        });

        await db.activityEvent.create({
          data: {
            campaignId: schedule.campaignId,
            type:
              publication.status === "PUBLISHED"
                ? "schedule.executed"
                : "schedule.failed",
            message:
              publication.status === "PUBLISHED"
                ? `Scheduled ${platform} publication completed`
                : `Scheduled ${platform} publication failed`,
            metadata: JSON.stringify({
              scheduleId: schedule.id,
              platform,
              contentVersion: campaign.contentVersion,
              publicationId: publication.id
            })
          }
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Scheduled publish failed.";

        await db.schedule.update({
          where: { id: schedule.id },
          data: {
            status: "FAILED",
            executedAt: new Date(),
            errorMessage: message
          }
        });

        await db.activityEvent.create({
          data: {
            campaignId: schedule.campaignId,
            type: "schedule.failed",
            message: `Scheduled ${schedule.platform} publication failed`,
            metadata: JSON.stringify({
              scheduleId: schedule.id,
              platform: schedule.platform,
              error: message
            })
          }
        });
      }
    }
  } catch (error) {
    console.error("Scheduler error:", error);
  } finally {
    schedulerRunning = false;
  }
}

const schedulerTimer = setInterval(runScheduler, 15000);
schedulerTimer.unref();

void recoverInterruptedSchedules().then(() => runScheduler());

app.listen(port, () => {
  console.log(`Postura API listening on http://localhost:${port}`);
  console.log("Postura scheduler active: checking due schedules every 15 seconds");
});

