# Architecture

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
  |                 +-- local CV or external vision provider
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

Used for background jobs and short-lived coordination. It is not a durable source of truth.

### Object storage

Stores private sketches, generated thumbnails, optional reference captures, and imported models. Curated style-guide assets ship with the web application rather than object storage.

## Curated style-guide boundary

The style guide is a typed frontend catalog backed by original, deterministic PNG assets under
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

- JSON logs
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
