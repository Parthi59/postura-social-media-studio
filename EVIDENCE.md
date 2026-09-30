POSTURA — EVIDENCE

Project

POSTURA — Social Media Studio

Core lifecycle:

Brief → Create → Adapt → Review → Approve → Publish → Verify → Learn

Core principle:

Create with freedom. Operate with control. Publish with proof.

This evidence file records the acceptance tests completed against the current Postura implementation.

1. API Health

Endpoint

GET /api/health

Observed result

{"ok":true,"service":"postura-api"}

Evidence

The API responded successfully on port 4000.

Result: PASS

2. Executable Constraint Profiles

Endpoint

GET /api/constraint-profiles

Observed profiles

Discord

maxLength: 2000

maxHashtags: 5

Mastodon

maxLength: 500

maxHashtags: 5

mock_x

maxLength: 280

maxHashtags: 2

mock_linkedin

maxLength: 3000

maxHashtags: 5

Tone rules include validation such as:

no more than two consecutive !

no fully-uppercase content

Result: PASS

3. Constraint Enforcement

A scheduled mock_x publish was rejected because the content contained:

Testing approval protection!!!

Observed result

{
"error":"Platform constraint validation failed.",
"platform":"mock_x",
"violations":[
{
"rule":"tone",
"message":"mock_x tone rule failed: more than two consecutive exclamation marks are not allowed."
}
]
}

The variant was then updated to:

Testing approval protection.

and later passed validation.

Result: PASS

4. Source Ingestion

A Markdown source was ingested through:

POST /api/posts/ingest

Created campaign

Source Ingestion Test

Campaign ID:

cmu4ddcuo002qi79cky8tqnt8

The resulting campaign had platform-specific variants for:

discord

mastodon

mock_linkedin

mock_x

Result: PASS

5. Human Approval Gate

A campaign named:

Unapproved Test

Campaign ID:

cmu4apnmr0000i79cofu8xl9i

was initially in DRAFT state.

Attempting to schedule before approval returned:

{"error":"Only the currently approved campaign version can be scheduled."}

This proves unapproved content cannot enter the publish queue.

Result: PASS

6. Review Note Gate

The interface blocked approval while an unresolved review note existed.

Observed message:

Resolve 1 review note on version 3 before approval.

After resolving the note, approval succeeded.

Result: PASS

7. Version-Aware Approval

The test campaign advanced to:

contentVersion: 3
approvedVersion: 3

Approval is tied to the exact content version. Edits create a new version and invalidate earlier approval.

Result: PASS

8. Approved Scheduling and Execution

Campaign:

cmu4apnmr0000i79cofu8xl9i

A valid mock_x schedule was created and executed.

Earlier successful schedule:

Schedule ID: cmu4bqqxe000ti79cuuktnnyk
status: PUBLISHED
publicationId: cmu4btfig000xi79cxbnj9lde

Result: PASS

9. Real Discord Publishing

Postura successfully published to Discord through the real platform adapter.

The message was confirmed as received in the configured Discord server.

A recorded Discord publication for the test campaign included:

platform: discord
status: PUBLISHED
httpStatus: 200
attemptCount: 1

Result: PASS

10. Real Mastodon Publishing

Postura successfully published through the real Mastodon adapter.

Recorded publication:

platform: mastodon
status: PUBLISHED
httpStatus: 200
externalUrl: https://mastodon.social/@masterkr14_k/117281813766799193

Result: PASS

11. Mock X Publishing

Campaign:

cmtyghc6b0000i7fosvxmhd22

Observed publication:

id : cmu4a3d1s000ti7gwkny8vboz
platform : mock_x
status : PUBLISHED
externalId : mock_x_503ed06403130139
externalUrl : mock://mock_x/503ed06403130139
idempotencyKey : mock_x:cmtyghc6b0000i7fosvxmhd22:v14:mock-test-1
httpStatus : 200
attemptCount : 1

Result: PASS

12. Idempotency

The same mock_x publish request was repeated using:

Idempotency-Key: mock-test-1

The second request returned the same publication identity:

id
externalId
idempotencyKey
timestamps
attemptCount

No duplicate publication was created.

Result: PASS

13. Mock LinkedIn Publishing

Campaign:

cmu4ddcuo002qi79cky8tqnt8

Observed publication:

id : cmu4dibrm002zi79ch87y7jaq
platform : mock_linkedin
status : PUBLISHED
externalId : mock_linkedin_0b3aa52cf0e87451
externalUrl : mock://mock_linkedin/0b3aa52cf0e87451
idempotencyKey : mock_linkedin:cmu4ddcuo002qi79cky8tqnt8:v1:mock-linkedin-test-1
httpStatus : 200
attemptCount : 1

Result: PASS

14. Adapter Seam — Default Publisher Swap

The API was started with:

$env:POSTURA_DEFAULT_PUBLISHER="mock_linkedin"
npm --workspace apps/api run dev

Startup confirmed:

[Postura] default publisher: mock_linkedin

The default publish endpoint then returned:

{
"adapter": "mock_linkedin",
"publication": {
"id": "cmu53z0yg0001i7pk6w5lo207",
"campaignId": "cmu4ddcuo002qi79cky8tqnt8",
"platform": "mock_linkedin",
"status": "PUBLISHED",
"externalId": "mock_linkedin_51d62d776801dea3",
"externalUrl": "mock://mock_linkedin/51d62d776801dea3",
"idempotencyKey": "mock_linkedin:cmu4ddcuo002qi79cky8tqnt8:v1:adapter-linkedin-final-1",
"httpStatus": 200,
"latencyMs": 0,
"errorMessage": null,
"attemptCount": 1
}
}

This proves the publishing adapter can be swapped through configuration without changing the campaign workflow.

Result: PASS

15. Durable Scheduler — Restart Recovery

A future mock_x schedule was created:

Schedule ID: cmu54auyt0001i7m4wwhml7ho
Campaign ID: cmu4apnmr0000i79cofu8xl9i
Platform: mock_x
Scheduled At: 2026-09-17T05:59:16.211Z
Status: SCHEDULED

The API process was stopped before execution, then restarted.

Startup after restart:

[Postura] default publisher: mock_x
Postura API listening on http://localhost:4000
Postura scheduler active: checking due schedules every 15 seconds

After restart, the persisted schedule was recovered and executed:

{
"id": "cmu54auyt0001i7m4wwhml7ho",
"campaignId": "cmu4apnmr0000i79cofu8xl9i",
"platform": "mock_x",
"scheduledAt": "2026-09-17T05:59:16.211Z",
"status": "PUBLISHED",
"executedAt": "2026-09-17T05:59:20.424Z",
"publicationId": "cmu54diqw0001i728a6cd8bcj",
"errorMessage": null
}

Result: PASS

16. Exactly-Once Scheduled Publication

The recovered schedule created the publication:

{
"id": "cmu54diqw0001i728a6cd8bcj",
"campaignId": "cmu4apnmr0000i79cofu8xl9i",
"platform": "mock_x",
"status": "PUBLISHED",
"externalId": "mock_x_f40f1b396fa2b529",
"externalUrl": "mock://mock_x/f40f1b396fa2b529",
"idempotencyKey": "mock_x:cmu4apnmr0000i79cofu8xl9i:v3:schedule:cmu54auyt0001i7m4wwhml7ho",
"httpStatus": 200,
"latencyMs": 1,
"errorMessage": null,
"attemptCount": 1,
"retryAfterMs": null
}

The schedule ID is embedded in the idempotency key and the publication completed with:

attemptCount: 1

This demonstrates restart-safe scheduled execution without duplicate publication for the tested schedule.

Result: PASS

17. Campaign Brain

Postura includes a working AI feature called:

Campaign Brain

Observed state:

READY

Model:

openai/gpt-oss-120b

Provider:

Groq

Campaign Brain evaluates campaign context such as:

source grounding

platform fit

review state

risks

publishing readiness

suggested next actions

Applying an AI suggestion creates a new campaign version and invalidates prior approval.

Result: PASS

18. Publication Receipts

Publication records preserve operational proof including:

platform

status

HTTP status

latency

attempt count

retry information

external ID

external URL where available

idempotency key

last attempt time

This provides an auditable delivery trail instead of a UI-only “published” state.

Result: PASS

Acceptance Summary

Capability

Result

API health

PASS

Source ingestion

PASS

Platform variants

PASS

Executable constraints

PASS

Constraint rejection

PASS

Human review

PASS

Review-note approval gate

PASS

Version-aware approval

PASS

Unapproved schedule rejection

PASS

Durable scheduling

PASS

Scheduler restart recovery

PASS

Exactly-once scheduled publish

PASS

Real Discord publish

PASS

Real Mastodon publish

PASS

Mock X adapter

PASS

Mock LinkedIn adapter

PASS

Adapter swap

PASS

Idempotency

PASS

Delivery receipts

PASS

Campaign Brain

PASS

Final Verification Still Required Before Submission

Run clean builds:

npm --workspace apps/api run build
npm --workspace apps/web run build

Then verify:

.env is not committed

no API tokens or platform secrets are present in source

.env.example contains placeholders only

README setup instructions work

repository is pushed to the final GitHub branch

screenshots / terminal evidence are added where useful
