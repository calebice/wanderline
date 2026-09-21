# Architecture

Status: Current
Authority: System boundaries and technical architecture
Last reviewed: 2026-09-20

## System overview

```text
Browser → React application → FastAPI → PostgreSQL
                                  ├── Redis → lesson worker → provider interfaces
                                  └── S3-compatible private object storage
```

The browser owns interaction only. Database, Redis, object-storage, and provider credentials never
cross into it. PostgreSQL is authoritative for sessions, jobs, usage, recipe versions, and trials;
Redis is coordination, not durable state.

## Product/application boundary

The React application uses one shell and these durable routes: `/`, `/explore`,
`/explore/styles/:style`, `/explore/feeling-first`, `/explore/color-study`, `/color-mixing`,
`/color-mixing/library`, `/color-mixing/library/new`, `/color-mixing/library/:id`,
`/color-mixing/library/:id/edit`, `/sessions`, `/sessions/new`, `/sessions/:id`,
`/sessions/:id/edit`, `/sessions/:id/target`,
`/sessions/:id/build/:runId`, `/settings/usage`, and `/internal/design-system`.

Supported legacy query URLs redirect to these paths while preserving their meaningful parameters.
Static curated references ship with the web application and do not require learner persistence.

## Retained API boundaries

- Health/readiness
- Painting lessons, references/assets, targets, generation runs, save/edit, and usage
- Color-mixing catalog and learner-scoped trials
- Learner-scoped physical color swatches and private swatch images

Color recipes have a stable catalog version, palette ID, and recipe slug. Each trial stores a recipe
snapshot plus version so history remains readable after later catalogs ship. Updates require
`expected_revision` and timestamps are UTC.

Physical swatches are independent of working mix notes. Each stores a versioned single-paint,
authored-recipe, or custom-mixture source plus structured material/capture observations. A one-to-one
asset owns the private original and bounded WebP display image. Metadata and image replacements use
the swatch revision; no v1 process derives a representative color from the photograph.

Drawing-era operations and their runtime dependencies were removed after a verified local export.
They are absent from OpenAPI; historical migrations remain as the immutable schema history.

## Painting-session persistence and jobs

`painting_lessons`, `lesson_assets`, `lesson_generation_runs`, and `generation_usage` remain the
painting source of truth. User-facing text says painting session; existing API/table “lesson” names
remain for compatibility. Originals and bounded display renditions are private objects.

The worker consumes `wanderline:lesson-generation`. Target, full lesson, stage/checkpoint, process
sheet, section, and tracing-outline work is retryable and records durable run state. A generated target
must be explicitly approved before full guidance. Section generation remains provisional until an
optimistic save commits the edited session.

`LessonTextProvider` and `StudyImageProvider` isolate external generation. The deterministic demo
provider remains the no-key fallback; OpenAI credentials and calls remain server-side with
`store: false`. Usage records preserve operation/model/token/cost provenance.

## Data ownership and storage

The local learner is represented by `learner_profiles`, which remains the ownership boundary for both
painting lessons and color trials. Future identity can replace lookup behavior without discarding
ownership columns.

S3-compatible storage holds lesson originals, generated/display assets, and physical-swatch
original/display pairs under a separate `color-swatches/` prefix. Curated guide, Feeling
First, Color Study, and lemon assets are static web files. No drawing-era object type remains.

## Deployment and observability

Docker Compose runs web, API, worker, PostgreSQL, Redis, and MinIO. `/health/live` checks the API
process; `/health/ready` checks PostgreSQL. Generation logs are structured and must
not include private image URLs or secrets. Services retain clear boundaries so Terminus may replace
TLS, identity, databases, queues, object storage, telemetry, and secret injection through configuration.

Frontend paths and API URLs must remain compatible with a configurable deployment base path.
