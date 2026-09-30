POSTURA — Social Media Studio

POSTURA is a Social Media Studio that combines a creative campaign workspace with a controlled publishing operating system.

It is designed around the full campaign lifecycle:

Brief → Create → Adapt → Review → Approve → Publish → Verify → Learn

POSTURA is not just a scheduler, not just an AI caption tool, and not just a dashboard.

Its core principle is:

Create with freedom. Operate with control. Publish with proof.

Product Overview

POSTURA combines two product layers:

1. Creative Workspace

A campaign can begin from a stored source brief or Markdown input and then evolve into platform-specific versions.

Each campaign can contain:

title

original source content

platform-specific variants

content version

approval state

review notes tied to the exact version

publication history

scheduled publishing state

delivery receipts

AI intelligence history

2. Social Media Operating System

POSTURA controls the publishing lifecycle through:

executable platform constraints

review and approval gates

version-aware approvals

durable scheduling

retry logic

idempotent publishing

adapter-based platform publishing

publication receipts

activity history

restart recovery

Key Features

Source Ingestion

POSTURA supports source-content ingestion through:

POST /api/posts/ingest

A single source can be transformed into channel-specific working variants.

Platform Variants

Supported adapters include:

Real adapters

Discord

Mastodon

Mock adapters

mock_x

mock_linkedin

Each platform uses its own executable constraint profile.

Examples include:

maximum content length

hashtag limits

tone validation

uppercase restrictions

repeated punctuation rules

Human Review and Approval

POSTURA keeps human approval inside the publishing workflow.

Important behavior:

approval belongs to an exact content version

editing content creates a new version

earlier approval becomes invalid after a new version is created

unresolved review notes block approval

unapproved content cannot be scheduled

Durable Scheduling

Scheduled campaigns are persisted instead of relying on browser state or in-memory timers.

The scheduler:

checks for due schedules periodically

executes approved campaign versions

records execution state

links schedules to publication receipts

recovers persisted schedules after API restart

Idempotent Publishing

Publishing is protected with idempotency keys.

A publication key includes information such as:

platform
campaign
content version
request/schedule identifier

Repeating the same idempotent request returns the existing publication instead of creating a duplicate.

Retry Engine

POSTURA includes retry handling for publish responses such as:

HTTP 408

HTTP 429

HTTP 5xx

Publication records retain:

attempt count

HTTP status

latency

Retry-After information

last attempt time

final error message where applicable

Publication Receipts

Successful or failed publish attempts produce operational receipts.

A publication record can include:

platform

status

external ID

external URL

idempotency key

HTTP status

latency

attempt count

retry metadata

timestamps

This makes publishing auditable instead of relying on a UI-only success state.

Campaign Brain

POSTURA includes an AI feature called Campaign Brain.

Current provider:

Groq

Current model:

openai/gpt-oss-120b

Campaign Brain evaluates the campaign workflow rather than generating isolated captions.

It can reason over:

original source

platform variants

platform fit

unresolved review state

approval state

campaign risks

publishing readiness

suggested next actions

Applying an AI suggestion creates a new campaign version and therefore invalidates any earlier approval.

AI does not replace the human approval gate.

Architecture

POSTURA is organized as a monorepo.

postura-studio/
├── apps/
│ ├── api/
│ └── web/
├── README.md
├── EVIDENCE.md
├── BUILDLOG.md
└── .env.example

Web

The frontend is built with:

React

TypeScript

Tailwind CSS / custom CSS

React Router

The product has two experiences:

/

Public POSTURA company website.

/studio

Working Social Media Studio.

Additional product routes include:

/campaigns
/review
/calendar
/publishing
/activity
/connections
/intelligence

API

The backend provides:

campaign persistence

source ingestion

platform variants

review workflow

approval workflow

publication adapters

scheduling

retries

idempotency

activity events

Campaign Brain

publication receipts

Publisher Adapter Seam

Publishing is separated behind a SocialPublisher-style adapter architecture.

The default publisher can be selected through configuration:

$env:POSTURA_DEFAULT_PUBLISHER="mock_linkedin"

Example supported publisher names:

discord
mastodon
mock_x
mock_linkedin

This allows platform implementation to change without changing the campaign workflow.

Environment Setup

Copy the example environment file:

Copy-Item .env.example .env

Fill in only the services you plan to use.

Never commit the real .env file.

Install

From the project root:

npm install

Database / Prisma

If Prisma setup is required:

npm --workspace apps/api exec prisma validate
npm --workspace apps/api exec prisma db push
npm --workspace apps/api exec prisma generate

Development

Run the project from the repository root.

API:

npm --workspace apps/api run dev

Web:

npm --workspace apps/web run dev

If the root development script starts both applications:

npm run dev

Production Build

API:

npm --workspace apps/api run build

Web:

npm --workspace apps/web run build

Both commands should complete without TypeScript errors before submission.

API Health Check

With the API running:

http://localhost:4000/api/health

Expected response:

{
"ok": true,
"service": "postura-api"
}

Core Acceptance Behaviors

POSTURA has been tested for:

API health

source ingestion

platform-specific variants

executable constraint validation

invalid-content rejection

human review

review-note approval blocking

version-aware approval

unapproved schedule rejection

real Discord publishing

real Mastodon publishing

mock_x publishing

mock_linkedin publishing

idempotency

adapter swapping

durable scheduling

restart recovery

exactly-once scheduled publication

publication receipts

Campaign Brain

Full test outputs are documented in:

EVIDENCE.md

Security

Do not commit:

Discord tokens / webhook secrets

Mastodon tokens

Groq API keys

database credentials

private platform credentials

Only placeholder values should exist in:

.env.example

Before submission, verify the repository contains no secrets.

Capstone Positioning

POSTURA is built as a Social Media Studio.

Its product philosophy is:

Creativity on one side. Control on the other. Intelligence in the middle.
