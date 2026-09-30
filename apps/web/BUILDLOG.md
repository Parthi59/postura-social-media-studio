POSTURA — BUILDLOG

This build log summarizes the development of POSTURA as a Social Media Studio capstone.

Phase 1 — Product Direction

The project was defined around the current Social Media Studio brief.

The product was intentionally positioned as more than:

a scheduler

a social dashboard

an AI caption generator

The system was designed around:

Brief → Create → Adapt → Review → Approve → Publish → Verify → Learn

The working product name became:

POSTURA — Social Media Studio

Phase 2 — Campaign Model

The campaign workflow was implemented around persisted campaign objects.

Campaign behavior includes:

title

source content

platform-specific variants

campaign status

content version

approved version

review notes

publications

schedules

activity history

Version-aware behavior became a central part of the workflow.

Phase 3 — Platform Variant System

Platform-specific variants were added for:

Discord

Mastodon

mock_x

mock_linkedin

Each platform uses a separate constraint profile.

Constraint checks include examples such as:

content length

hashtag count

tone rules

repeated punctuation

uppercase restrictions

Invalid content is rejected before publishing.

Phase 4 — Review and Approval

Human review was added before publishing.

Important workflow rules:

unresolved review notes block approval

approval belongs to the current version

editing content creates a new version

a new version invalidates previous approval

only the currently approved version can be scheduled

This prevents stale or unreviewed content from being published.

Phase 5 — Publishing Adapter Architecture

Publishing was implemented behind a platform adapter seam.

Adapters include:

Real

Discord

Mastodon

Mock

mock_x

mock_linkedin

A configurable default publisher was added through:

POSTURA_DEFAULT_PUBLISHER

This allowed adapter-swapping tests without changing the campaign workflow.

Phase 6 — Real Platform Publishing

Real Discord publishing was implemented and verified.

A Discord message was successfully received in the configured server.

Real Mastodon publishing was also implemented and verified with an external Mastodon post URL.

Phase 7 — Idempotency

Idempotency was added as a core publishing guarantee.

The same idempotency key returns the same publication instead of creating duplicates.

The publication key is derived from information such as:

platform
campaign
content version
request/schedule identifier

Repeated mock_x publishing using the same key returned the existing publication.

Phase 8 — Retry Engine

The publisher retry engine was implemented for transient failures.

Retry handling includes:

408

429

5xx responses

Publication history stores:

number of attempts

HTTP status

latency

Retry-After values

last attempt timestamp

error information

Phase 9 — Scheduling

Durable schedules were added.

Schedules are persisted with:

campaign

platform

scheduled time

status

execution time

publication link

error state

The worker checks due schedules approximately every 15 seconds.

Phase 10 — Restart Recovery

The scheduler was tested across an API restart.

Test schedule:

cmu54auyt0001i7m4wwhml7ho

The API was stopped before the scheduled publish time.

After the API restarted, the stored schedule was recovered and executed.

Result:

status: PUBLISHED
publicationId: cmu54diqw0001i728a6cd8bcj
attemptCount: 1

This proved durable restart recovery.

Phase 11 — Exactly-Once Scheduled Publishing

The recovered schedule produced one publication using the schedule ID inside the idempotency key:

mock_x:cmu4apnmr0000i79cofu8xl9i:v3:schedule:cmu54auyt0001i7m4wwhml7ho

This provided exactly-once protection for the tested scheduled execution.

Phase 12 — Source Ingestion

A source-ingestion route was added:

POST /api/posts/ingest

A Markdown source could be stored and used to create platform-specific variants.

The test campaign:

Source Ingestion Test

successfully produced variants for all supported test platforms.

Phase 13 — Campaign Brain

A real AI workflow feature called Campaign Brain was added.

Provider:

Groq

Model:

openai/gpt-oss-120b

Campaign Brain was designed to understand workflow state rather than act as a standalone caption generator.

It analyzes:

source grounding

channel fit

campaign risks

approval state

publishing readiness

suggested actions

Applying an AI suggestion creates a new campaign version.

Phase 14 — Product UI

The web product evolved into two layers.

Public Company Website

Route:

/

This presents POSTURA as a Social Media Studio.

Product Workspace

Route:

/studio

The studio contains:

campaign workspace

review queue

calendar

publishing desk

activity

connections

Campaign Brain

Postura Pulse

The frontend was intentionally kept separate from the marketing website so the actual application could remain operational and product-focused.

Phase 15 — Command Center

A POSTURA Command Center was introduced as an operational product feature.

It represents campaign state through:

SOURCE → VERSION → APPROVAL → CHANNELS → PUBLISH

The feature is driven by real campaign state instead of fabricated analytics.

Phase 16 — Acceptance Testing

The following behaviors were manually verified:

API health

constraint profiles

invalid content rejection

source ingestion

review-note approval gate

version-aware approval

unapproved scheduling rejection

approved scheduled publishing

real Discord publish

real Mastodon publish

mock_x publish

mock_linkedin publish

idempotency

adapter swapping

durable scheduling

restart recovery

exactly-once scheduled publication

Campaign Brain

Detailed outputs are recorded in:

EVIDENCE.md

Final Submission Tasks

Before submission:

run clean API build

run clean web build

confirm .env is ignored

confirm no tokens or credentials are committed

verify .env.example contains placeholders only

verify README setup steps

push final repository state

optionally add screenshots to the repository
