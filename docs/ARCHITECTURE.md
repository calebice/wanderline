# Architecture

Status: Current
Authority: System boundaries and technical architecture
Last reviewed: 2026-09-09

## System overview

```text
Browser
  |
  v
Web application
  |
  v
FastAPI service ---- PostgreSQL
  |                    |
  |                    +-- application metadata
  |
  +---- Redis ---- Worker
  |                 |
  |                 +-- lesson text/study providers or local demo provider
  |
  +---- S3-compatible object storage
```

## Service boundaries

### Web

Responsible for:

- User interaction
- Practice-session UI
- 3D reference rendering
- Static curated style-guide catalog and accessible image guidance
- Upload orchestration
- Progress visualization

The browser must not receive database, Redis, object-storage, or AI-provider credentials.

### API

Responsible for:

- Authentication and authorization boundaries
- Domain rules
- Persistence
- Presigned upload creation
- Job dispatch
- Recommendation generation
- Stable versioned API contracts

### Worker

Responsible for:

- Thumbnail creation
- Image metadata extraction
- Computer-vision analysis
- Optional external AI requests
- Retryable long-running work

### PostgreSQL

Source of truth for users, exercises, sessions, sketches, analyses, and progress evidence. The curated style guide is versioned static application content and does not require learner persistence.

### Redis

Carries the lesson-generation queue and short-lived coordination. PostgreSQL remains the source of
truth for job state, attempts, recoverable errors, and generated snapshots; Redis is not the lesson
record.

### Object storage

Stores private sketches, generated thumbnails, optional reference captures, and imported models. Curated style-guide assets ship with the web application rather than object storage.

### Lesson providers

`LessonTextProvider` and `StudyImageProvider` are isolated protocols. The deterministic demo text
provider is used when `LESSON_GENERATION_PROVIDER=auto` has no OpenAI key. The OpenAI text provider
sends a primary display image and optional secondary context images to the Responses API with a
strict JSON schema and `store: false`. The optional study provider uses one primary-image edit with
the configured image model. Routes and persistence do not contain provider-specific calls.

### Photo-to-lesson persistence

Migration `0009` adds `painting_lessons`, `lesson_assets`, and `lesson_generation_runs`. A lesson
belongs to the local learner, stores versioned metadata/content and an optimistic revision, and is
listed only after `saved_at` is set. Original upload bytes and display renditions are private S3
objects. A partial unique index guarantees one primary original reference per lesson; deleting the
primary compacts order and promotes the first remaining asset.

The worker consumes `wanderline:lesson-generation`, updates queued/running/completed/failed state,
and records JSON logs with run, lesson, scope, provider, model, attempt, and error fields. Full
generation writes a draft content snapshot; section regeneration writes only a provisional run
snapshot until the editor saves the complete lesson.

## Curated style-guide boundary

The style guide is a typed frontend catalog backed by original, deterministic WebP assets under
`apps/web/public/style-guide/`. It makes no learner API calls. Thumbnails are precached with the
application shell; full references and process sheets enter the service-worker cache after they are
viewed. Research notes, final prompt summaries, and approval history live in `docs/` so the visual
direction remains reviewable without becoming runtime data.

## Provider interfaces

### AnalysisProvider

```python
class AnalysisProvider(Protocol):
    async def analyze(self, request: AnalysisRequest) -> AnalysisResult:
        ...
```

Implement:

- MockAnalysisProvider
- LocalCvAnalysisProvider
- LocalShapeDecompositionProvider
- VisionModelAnalysisProvider

The local shape provider analyzes a bounded, downscaled copy synchronously and stores normalized,
versioned geometry in the analysis JSON payload. Originals remain private in S3-compatible storage;
browser-generated SVG and PNG reconstructions contain only the selected geometry.

### ObjectStorageProvider

Support S3-compatible APIs so local MinIO and hosted S3 can use the same implementation.

### IdentityProvider

Start with a local development user. Keep authorization boundaries compatible with later OIDC integration.

## Observability

- JSON logs from the lesson worker
- Request ID propagation
- Health and readiness endpoints
- OpenTelemetry hooks
- Job duration and failure metrics
- No sensitive upload URLs or provider keys in logs

## Deployment modes

### Local development

Docker Compose runs all services.

### Terminus deployment

Terminus may replace:

- Reverse proxy
- TLS termination
- OIDC
- PostgreSQL
- Redis
- Object storage
- OpenTelemetry collector
- Secret injection

Wanderline should require only environment configuration changes.

## Health behavior

`/health/live` verifies the API process is running.

`/health/ready` verifies required dependencies such as PostgreSQL. Object storage and Redis readiness may be reported separately to avoid taking read-only routes offline unnecessarily.

## Base path support

Frontend routing and API URLs must support deployment behind a configurable path such as:

```text
https://terminus.example/wanderline/
```

Avoid hard-coded root-relative assumptions.
