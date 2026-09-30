# POSTURA — Social Media Studio

**Create with freedom. Operate with control. Publish with proof.**

POSTURA is an AI-powered Social Media Studio that manages the full campaign lifecycle — from content creation and platform adaptation to human review, approval, scheduling, real publishing, verification, and audit history.

[Live Product](https://postura-social-media-studio.vercel.app) · [API Health](https://postura-social-media-studio-production.up.railway.app/api/health)

## What POSTURA solves

Most social tools stop at content generation or scheduling. POSTURA treats publishing as an operational workflow:

**Brief → Create → Adapt → Review → Approve → Publish → Verify → Learn**

A campaign is versioned, reviewed, approved, scheduled, published through real platform adapters, and recorded with delivery evidence.

## Production capabilities

- Real Discord publishing
- Real Mastodon publishing
- Platform-specific campaign variants
- Version-aware human approval workflow
- Review notes with resolve/reopen state
- Approval invalidation after content edits
- Durable scheduling with restart recovery
- Retry handling for HTTP 408, 429 and 5xx responses
- Idempotent publishing to prevent duplicate delivery
- Publication receipts with HTTP status, latency, external IDs and attempt history
- Campaign activity/audit trail
- AI Campaign Brain for readiness, risks and next actions
- Real connection-status reporting from the backend

## Campaign Brain

POSTURA includes an AI operations layer called **Campaign Brain**.

It evaluates the current campaign state rather than acting as a generic caption generator. It can reason over:

- source content
- Discord and Mastodon variants
- unresolved review notes
- approval state
- publishing readiness
- operational risks
- suggested next actions

Provider: **Groq**  
Model: **openai/gpt-oss-120b**

Applying an AI suggestion creates a new campaign version, which invalidates the previous approval. Human approval remains part of the publishing gate.

## Architecture

```text
                     ┌─────────────────────┐
                     │   POSTURA Web App   │
                     │ React + TypeScript  │
                     │      Vercel         │
                     └──────────┬──────────┘
                                │ HTTPS
                                ▼
                     ┌─────────────────────┐
                     │    POSTURA API      │
                     │ Express + Prisma    │
                     │      Railway        │
                     └──────┬───────┬──────┘
                            │       │
                     ┌──────▼───┐ ┌─▼──────────┐
                     │ Discord  │ │ Mastodon   │
                     │ Adapter  │ │ Adapter    │
                     └──────────┘ └────────────┘
                            │
                            ▼
                     Campaign receipts,
                     schedules & activity
```

## Tech stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS / custom CSS
- React Router
- Vercel

**Backend**
- Node.js
- Express
- TypeScript
- Prisma
- SQLite
- Railway

**AI & Integrations**
- Groq API
- openai/gpt-oss-120b
- Discord Webhooks
- Mastodon API

## Core product routes

- `/studio` — campaign workspace
- `/campaigns` — campaign management
- `/review` — review queue
- `/calendar` — scheduled publishing
- `/publishing` — publication receipts
- `/activity` — audit trail
- `/connections` — live publisher status
- `/intelligence` — Campaign Brain

## Publishing workflow

1. Create or ingest campaign content.
2. Adapt content into platform-specific variants.
3. Send the current version to review.
4. Resolve review notes.
5. Approve the exact content version.
6. Publish immediately or schedule delivery.
7. POSTURA records attempts, latency, response status and external publication data.
8. Activity history preserves the operational trail.

Editing approved content creates a new version and requires approval again.

## Reliability controls

### Idempotency

Publication keys are tied to platform, campaign, content version and request/schedule identifiers. Repeating the same idempotent operation does not intentionally create a duplicate publication.

### Retry engine

POSTURA retries eligible failures, including:

- HTTP 408
- HTTP 429
- HTTP 5xx

Each publication stores attempt count, HTTP status, latency, retry information and the final result.

### Scheduler recovery

Schedules are persisted. On API restart, interrupted work is recovered and due schedules are checked again instead of relying on a browser timer.

## Repository structure

```text
postura-social-media-studio/
├── apps/
│   ├── api/          # Express API, Prisma, scheduler, publishers
│   └── web/          # React/Vite product frontend
├── EVIDENCE.md       # functional verification notes
├── README.md
├── package.json
└── .gitignore
```

## Local setup

```bash
npm install
```

Create `apps/api/.env` from `apps/api/.env.example` and provide only the services you want to use.

Required database configuration:

```env
DATABASE_URL="file:./dev.db"
```

Optional production integrations:

```env
DISCORD_WEBHOOK_URL=""
MASTODON_BASE_URL=""
MASTODON_ACCESS_TOKEN=""
GROQ_API_KEY=""
GROQ_MODEL="openai/gpt-oss-120b"
```

Never commit real credentials.

### Run locally

```bash
npm run dev
```

Or run each workspace separately:

```bash
npm --workspace apps/api run dev
npm --workspace apps/web run dev
```

### Production build

```bash
npm --workspace apps/api run build
npm --workspace apps/web run build
```

## Deployment

**Frontend:** Vercel  
**Backend:** Railway

Frontend production environment:

```env
VITE_API_URL=https://postura-social-media-studio-production.up.railway.app
```

Backend CORS origin:

```env
WEB_ORIGIN=https://postura-social-media-studio.vercel.app
```

## Verification

The deployed system has been verified for:

- API health
- real Discord connection
- real Mastodon connection
- real Discord publishing
- real Mastodon publishing
- review and approval gating
- version invalidation
- scheduling
- retry behavior
- idempotency
- publication receipts
- activity history
- Campaign Brain

See `EVIDENCE.md` for additional implementation evidence.

---

**POSTURA** — Creativity on one side. Control on the other. Intelligence in the middle.
