# Wanderline

Status: Current
Authority: Product overview and local development guide
Last reviewed: 2026-09-09

Wanderline is a container-first, paper-first drawing studio that gives a true beginner one inviting 15-minute practice at a time. A four-week fundamentals path, gentle pacing, durable reflections, optional 3D references, and on-demand sketch guidance help learners explore their creativity without grades or streak pressure.

The product is intended to fit into the **Terminus project ecosystem** as an independently deployable service with clear API boundaries, health checks, persistent storage, and Docker Compose support.

## Product vision

Wanderline answers two questions for the user:

1. What should I practice next?
2. What small thing did I notice today?

The first release should focus on a reliable practice loop:

1. See one recommended lesson.
2. Learn one concept with a visual example.
3. Draw on paper with a gentle phased timer.
4. Record the level and an optional takeaway.
5. Continue, repeat more simply, or stop without penalty.

Sketch upload and critique remain a separate, optional tool.

## Initial capabilities

- Guided drawing exercises
- Random prompt and reference generation
- Interactive Scene Breakdown Studio with layered composition, construction, measurement, and lighting guides
- Curated style reference guide with five original finished examples, attainable learner versions, and four-stage process sheets
- STL, OBJ, and glTF reference loading
- Sketch upload and session history
- Rule-based image measurements
- Local geometric image decomposition with SVG/PNG study exports
- Reusable photo-to-watercolor lessons with private references, editable stages, and saved drafts
- AI-assisted critique
- Skill profiles and progress history
- Personalized daily practice plans
- Containerized local development

## Sketch analysis MVP

Open `/upload` or choose **Analyze a sketch** from the dashboard. The first analysis slice:

- accepts JPEG, PNG, and HEIC/HEIF sketches up to the configured byte and pixel limits;
- normalizes HEIC/HEIF and mislabeled Apple JPEG exports to JPEG before private storage;
- validates the file signature and image dimensions before storage;
- stores the original privately in S3-compatible object storage;
- reports defensible local measurements such as contrast, edge density, page occupancy,
  dominant line directions, approximate stroke fragmentation, visual balance, center of activity,
  and mirror similarity;
- displays the privately stored sketch with selectable footprint, visual-center, edge-hotspot,
  and dominant-direction overlays;
- uses the user-declared target to build a versioned coaching rubric with estimated penmanship,
  line-confidence, value-development, composition, and applicable frontal-structure scores;
- summarizes descriptive style signals and prioritizes three concrete focus areas for the next pass;
- separates measurements from coaching suggestions and labels confidence and limitations;
- records an optional user-provided subject for context and future correction workflows.

Semantic subject recognition and general vision-model critique are not enabled in the local
provider. The interface states this directly instead of presenting a heuristic guess as fact.
Target-aware checks use the subject supplied by the user as rubric context; local CV does not
claim to locate or verify individual parts of that subject.
The review links to the public OpenCV documentation for its edge and line-detection methods and
to a public drawing exercise on planning confident strokes.

## Image breakdown

Open `/breakdown` to turn one clear reference image into a private geometric study. The local
OpenCV provider fits large visible regions to rectangles, triangles, circles, ellipses, rotated
rectangles, quadrilaterals, or simplified polygons. Results include simple, medium, and detailed
layers, optional construction-form hints, a large-to-small drawing order, and clean SVG/PNG
exports that never embed the source photo.

The feature describes geometry rather than recognizing objects or semantic parts. It works best
with one well-separated subject and reports limitations when low contrast, texture, or clutter
make the decomposition uncertain.

The reusable photo-to-watercolor workflow is documented in
[docs/PHOTO_TO_LESSON.md](docs/PHOTO_TO_LESSON.md). It covers the creator, review/editor, saved
library, provider configuration, API endpoints, private assets, and the current verification
matrix.

## Photo-to-lesson workflow

The Style Reference Studio includes a **Create lesson from photo** flow and an on-demand saved
lesson library. A draft accepts up to six private JPEG, PNG, WebP, or HEIC/HEIF references; the
first is primary until another is selected. Source bytes remain in S3-compatible storage and the
UI receives an orientation-corrected, bounded WebP rendition through a private API response.

Lesson text and optional study-image creation run as durable Redis jobs. Set
`LESSON_GENERATION_PROVIDER=auto` to use OpenAI when `OPENAI_API_KEY` is present, or the clearly
labeled deterministic demo provider otherwise. The study-image option is off by default. OpenAI
text generation uses `OPENAI_LESSON_MODEL` and image edits use `OPENAI_IMAGE_MODEL`; credentials
are server-side only. Edited lessons save with optimistic revisions, and a stale revision returns
HTTP 409.

## Recommended stack

- Web: React, TypeScript, Vite
- UI: Tailwind CSS
- 3D: Three.js with React Three Fiber
- Drawing overlays: Canvas or SVG
- API: Python 3.12, FastAPI, Pydantic
- Data: PostgreSQL
- Jobs: Redis plus a worker process
- Object storage: S3-compatible storage; MinIO locally
- Computer vision: OpenCV and Pillow
- Database migrations: Alembic
- Testing: Pytest, Vitest, Playwright
- Packaging: Docker and Docker Compose

## Start locally

```bash
cp .env.example .env
docker compose up --build
```

Run that command from the repository root. The web service builds from `apps/web/Dockerfile`; if
you run Compose from another directory, pass the compose file explicitly:
`docker compose -f /path/to/wanderline/compose.yaml up --build`.

The API container applies migrations and idempotently seeds three exercises before serving traffic.
Wait for all services to report healthy, then open the web application. Stop the stack with
`docker compose down`; named volumes retain data.

Services:

- Web: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- MinIO console: http://localhost:9001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Repository layout

```text
apps/
  api/       FastAPI service
  web/       React frontend
docs/
  PRODUCT.md
  ARCHITECTURE.md
  PHOTO_TO_LESSON.md
  ROADMAP.md
infra/
CODEX.md     Primary Codex implementation brief
compose.yaml
```

## Terminus integration assumptions

Wanderline should remain deployable as a standalone service and expose:

- `GET /health/live`
- `GET /health/ready`
- Versioned HTTP APIs under `/api/v1`
- Configuration exclusively through environment variables
- Structured JSON logs to stdout
- No reliance on local filesystem persistence
- S3-compatible object storage for uploads
- PostgreSQL for durable application data
- Optional OIDC integration for shared Terminus authentication

See `docs/ARCHITECTURE.md` for integration details.

## Development checks

Run these commands from the repository root:

```bash
uv sync --project apps/api --extra dev
uv run --project apps/api ruff check apps/api
uv run --project apps/api ruff format --check apps/api
uv run --project apps/api mypy apps/api/app
uv run --directory apps/api pytest tests

npm --prefix apps/web install
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run test:e2e
```

For a Terminus subpath, set `BASE_PATH` (for example `/wanderline/`) and set
`PUBLIC_API_URL` to the externally routed API URL. Configure `CORS_ORIGINS` as a comma-separated
list of allowed web origins.

### Local Terminus router

When the local Terminus platform is running on port 8080, connect Wanderline to its external
Traefik network with:

```bash
docker compose -f compose.yaml -f infra/compose.terminus.yaml up --build -d
```

The routed endpoints are:

- Web: `http://wanderline.localhost:8080`
- Sketch analysis: `http://wanderline.localhost:8080/upload`
- API: `http://wanderline-api.localhost:8080`
- Readiness: `http://wanderline-api.localhost:8080/health/ready`

If ports 9000 or 9001 are already in use on your machine, override the host-side MinIO ports in
`.env` while keeping the container-side S3 endpoint unchanged:

```dotenv
MINIO_API_PORT=9002
MINIO_CONSOLE_PORT=9003
S3_PUBLIC_ENDPOINT_URL=http://localhost:9002
```

Then rerun `docker compose up --build`. The API and worker continue using
`http://minio:9000` inside the Compose network.
