# Codex Implementation Brief

Status: Current
Authority: Stable implementation contract and working rules
Last reviewed: 2026-09-09

You are implementing **Wanderline**, a containerized, paper-first drawing studio designed to run within the user's Terminus project ecosystem.

Treat this file as the primary implementation contract.

## Objective

Build a polished MVP that lets a user:

1. Choose a drawing skill or goal.
2. Start a guided practice exercise.
3. View a generated prompt or manipulable 3D reference.
4. Upload a completed sketch.
5. Receive structured, actionable feedback.
6. Track practice history and recommended next steps.

Prioritize a functional vertical slice over broad feature coverage.

## Product principles

- The user should never be unsure what to practice next.
- Feedback must be specific and actionable.
- The application is an encouraging studio guide, not a judge or general-purpose illustration editor.
- Practice sessions should be short, approachable, and repeatable.
- AI features must degrade gracefully when no external model is configured.
- The system must be container-first and suitable for self-hosting.

## MVP scope

### 1. Practice dashboard

Show:

- Today's recommended practice
- Current focus skill
- Recent sessions
- Practice streak
- Skill progress summary
- A prominent "Start practice" action

### 2. Exercise library

Seed exercises for:

- Ghosted lines
- Ellipses
- Boxes in perspective
- Form construction
- Value scales
- Contour drawing
- Negative-space drawing
- Timed object studies
- Simple landscapes

Each exercise should define:

```json
{
  "id": "ghosted-lines-001",
  "title": "Ghosted Lines",
  "skill": "line_control",
  "difficulty": 1,
  "duration_minutes": 10,
  "instructions": [],
  "completion_requirements": {},
  "reference_mode": "generated"
}
```

### 3. Prompt generator

Generate prompts from composable fields:

- Subject
- Difficulty
- Time limit
- View angle
- Lighting direction
- Constraint
- Target skill

Example:

> Draw a simple mug from a low three-quarter view with light from the upper left. Use no more than 30 strokes.

The MVP may use deterministic templates and seeded randomness. Do not require generative-image APIs.

### 4. Interactive scene breakdown studio

Implement with React Three Fiber.

MVP features:

- A paper-first predict, reveal, draw, and compare study loop
- Layered guides for framing, large masses, shared perspective, primitives, measurements, and light/shadow families
- At least one primitive study and one grouped still-life study using the same scene contract
- Per-scene progress saved locally without changing the practice-session schema
- Cube, sphere, cylinder, cone, and simple grouped forms
- Orbit, zoom, and reset camera
- Perspective and orthographic camera modes
- Adjustable field of view
- Directional light controls
- Wireframe toggle
- Edge overlay
- Ground plane and perspective grid
- Screenshot/reference capture
- Local STL, OBJ, or glTF loading where practical

Do not build a full model editor.

### 5. Sketch upload

Support JPEG and PNG initially.

Store:

- Original file
- Thumbnail
- Width and height
- Upload timestamp
- Associated practice session
- Optional reference image
- Analysis status

Use presigned object-storage URLs where possible.

### 6. Analysis pipeline

Implement analysis as a provider interface.

Providers:

1. `local_cv`
2. `vision_model`
3. `mock`

The default local provider should calculate basic, defensible measurements:

- Image dimensions
- Contrast range
- Edge density
- Approximate stroke fragmentation
- Approximate dominant line angles
- Bounding-box occupancy
- Basic value histogram

Do not present heuristic measurements as objective artistic truth.

Return:

```json
{
  "provider": "local_cv",
  "summary": "Your marks are concentrated near the center...",
  "strengths": [],
  "improvements": [],
  "metrics": {},
  "recommended_exercise_ids": [],
  "confidence": 0.0
}
```

When a vision model is configured, it may add semantic critique, but output must conform to the same schema.

### 7. Progress tracking

Track skill scores as trends rather than absolute talent ratings.

Initial skills:

- line_control
- shape_accuracy
- perspective
- proportion
- value
- composition
- observation
- form_construction

Use a 0–100 display score, but store underlying evidence and calculation version. Clearly label scores as estimates.

### 8. Adaptive recommendations

Start with a transparent rules engine.

Example:

- If three recent line-control sessions show high fragmentation, recommend ghosted lines.
- If box exercises repeatedly show inconsistent convergence, recommend perspective drills.
- If the user has not practiced in seven days, recommend a short re-entry session.

Do not introduce an opaque recommendation model in the MVP.

## Required API endpoints

Use `/api/v1`.

```text
GET    /health/live
GET    /health/ready

GET    /api/v1/exercises
GET    /api/v1/exercises/{exercise_id}
POST   /api/v1/practice-sessions
GET    /api/v1/practice-sessions
GET    /api/v1/practice-sessions/{session_id}
POST   /api/v1/practice-sessions/{session_id}/complete

POST   /api/v1/prompts/generate

POST   /api/v1/uploads/presign
POST   /api/v1/sketches
GET    /api/v1/sketches/{sketch_id}

POST   /api/v1/analyses
GET    /api/v1/analyses/{analysis_id}

GET    /api/v1/progress
GET    /api/v1/recommendations/today
```

## Core entities

- User
- Skill
- Exercise
- PracticeSession
- GeneratedPrompt
- Sketch
- Analysis
- AnalysisMetric
- SkillObservation
- Recommendation

Use UUID primary keys and UTC timestamps.

## Frontend routes

```text
/                 Dashboard
/practice         Exercise selection
/practice/:id     Active practice session
/studio/3d        Scene breakdown and 3D reference studio
/upload           Upload and analyze
/history          Practice history
/progress         Skill progress
/settings         App and provider settings
```

## UX requirements

- Desktop-first but responsive
- Keyboard-accessible controls
- Avoid a cluttered professional-art-tool interface
- Keep the primary practice action obvious
- Use progressive disclosure for advanced 3D controls
- Include empty, loading, success, and failure states
- Explain what each analysis metric means
- Never use insulting or overly authoritative critique language
- Treat internal clipping as a release-blocking regression: cards, grid tracks, headings,
  body copy, prompts, and actions must remain inside their visible containers at narrow
  widths and with enlarged text. See `docs/UI_REGRESSIONS.md` for the permanent checks.

## Backend standards

- Python 3.12
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x
- Alembic
- Async database access
- Ruff for formatting and linting
- Mypy for type checks
- Pytest for tests
- Structured JSON logging
- Explicit service and repository layers
- Dependency injection through FastAPI dependencies
- No business logic in route handlers

## Frontend standards

- TypeScript strict mode
- React
- Vite
- React Router
- TanStack Query
- React Hook Form where forms are nontrivial
- Zod for runtime validation
- React Three Fiber for 3D
- Vitest and React Testing Library
- Playwright for critical flows

## Container requirements

Provide containers for:

- `web`
- `api`
- `worker`
- `postgres`
- `redis`
- `minio`

Requirements:

- Multi-stage Docker builds
- Non-root runtime users for application containers
- Health checks
- Named volumes
- Environment-based configuration
- No credentials committed to the repository
- Production-ready images distinct from development overrides
- Graceful shutdown
- Idempotent migrations

## Terminus ecosystem compatibility

Assume Terminus may provide shared routing, authentication, observability, and secrets.

Implement optional support for:

- `BASE_PATH`
- `PUBLIC_API_URL`
- `OIDC_ISSUER_URL`
- `OIDC_CLIENT_ID`
- `OIDC_AUDIENCE`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `S3_ENDPOINT_URL`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `DATABASE_URL`
- `REDIS_URL`

The app must also work without Terminus using local Compose services.

## Security requirements

- Validate MIME type and file signatures
- Enforce configurable upload-size limits
- Generate random object keys
- Do not trust user-supplied filenames
- Sanitize imported model metadata
- Add rate-limit hooks around upload and AI endpoints
- Do not expose internal object-storage credentials to the browser
- Store no external AI provider key in frontend code
- Include basic content-security-policy guidance
- Avoid executing uploaded model content

## Testing acceptance criteria

At minimum:

- API health checks pass
- Database migrations apply to an empty database
- Seed exercises load idempotently
- Prompt generation is deterministic with a supplied seed
- A practice session can be created and completed
- A sketch record can be created against a stored upload
- A local analysis job can complete
- The dashboard renders seeded data
- The 3D studio renders and rotates a cube
- The main end-to-end practice flow passes in Playwright
- `docker compose up --build` reaches a healthy state

## Implementation order

### Phase 0: Foundation

- Monorepo structure
- Compose stack
- API and web health checks
- PostgreSQL migrations
- CI checks
- Seed system

### Phase 1: Practice vertical slice

- Exercise library
- Practice session lifecycle
- Prompt generator
- Dashboard
- History

### Phase 2: Upload and analysis

- MinIO integration
- Sketch upload flow
- Worker queue
- Local CV analysis
- Analysis results UI

### Phase 3: 3D reference studio

- Primitive gallery
- Camera and lighting controls
- Reference capture
- Model import

### Phase 4: Adaptation and progress

- Skill observations
- Trend visualization
- Rule-based recommendations
- Daily practice plan

## Codex working instructions

1. Read this file, `README.md`, `docs/PROJECT_STATE.md`, and `docs/README.md` before making changes.
   Load only the product, architecture, feature, decision, and regression documents relevant to
   the task. Read all of `docs/` only when performing a documentation audit.
2. Work in small, reviewable commits.
3. Maintain a running checklist in the pull request or task output.
4. Add tests with each behavior.
5. Do not silently replace architecture choices.
6. Record major decisions in `docs/decisions/` as ADRs.
7. Prefer simple, explicit implementations over speculative abstractions.
8. Keep all development commands runnable from the repository root.
9. Update documentation whenever environment variables or startup steps change.
10. Before declaring a phase complete, run:
   - backend lint, type checks, and tests
   - frontend lint, type checks, and tests
   - Playwright critical flow
   - Docker Compose health verification
11. For responsive UI changes, test component bounds—not only document scroll width—at
    narrow widths and 200% text sizing. Verify every content variant, especially the longest.

## Foundation task history

The following section describes the original foundation task. It is historical context, not the
default current implementation target. Use `docs/PROJECT_STATE.md` and `docs/ROADMAP.md` to
determine the current next task.

## First Codex task (Historical)

Implement Phase 0 and the smallest Phase 1 vertical slice:

- Bring up the full Compose dependency stack.
- Implement the API and web application skeletons.
- Add database migrations for exercises and practice sessions.
- Seed three exercises.
- Implement exercise listing and practice-session creation.
- Render those exercises in the web application.
- Add a working 3D cube proof of concept at `/studio/3d`.
- Add tests and setup documentation.

Stop after this vertical slice and provide:

- Completed checklist
- Commands run
- Test results
- Architecture decisions
- Known limitations
- Recommended next task
