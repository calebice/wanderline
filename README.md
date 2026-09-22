# Wanderline

Status: Current
Authority: Product overview and local development guide
Last reviewed: 2026-09-20

Wanderline is a container-first, watercolor-first painting studio. Its home page helps one local
learner resume an active painting or start a new one; Explore, saved sessions, Color Study, and saved
color-mixing trials support the work without turning it into a score.

## What it does

- Creates painting sessions from private photos or supported ideas
- Generates an approval-gated target, editable guidance, layer studies, and Simple Recipes
- Saves/reopens sessions and reports generation usage
- Provides authored style references, Feeling First, Color Study, and the canonical lemon lesson
- Serves 36 versioned Emily Lex color-mixing starting recipes and saves learner notes/adjustments
- Builds a private Color Library from photographed physical single-paint, authored-mix, and custom-mix swatches
- Runs as a separate web/API/worker stack with PostgreSQL, Redis, and S3-compatible storage

Color recipes and screen swatches are illustrative until physically validated with the learner’s
paint, paper, and water. Simple Recipe v1 and the Feeling First selector are protected contracts.

Drawing curriculum, generic exercises/practice/progress, sketch critique, image decomposition, and 3D
configuration are retired and removed. Their pre-removal records were exported locally before the
drop migration. See [the audit](docs/FEATURE_API_AUDIT.md).

## Start locally

```bash
cp .env.example .env
docker compose up --build
```

Wait for all services to become healthy, then open:

- Web: http://localhost:3000
- API: http://localhost:8000
- API documentation: http://localhost:8000/docs
- MinIO console: http://localhost:9001

Named volumes retain data when `docker compose down` stops the stack.

## Application routes

- `/` — start/resume and recent sessions
- `/explore` — authored references and learning tools
- `/color-mixing` — recipes and saved mix notes
- `/color-mixing/library` — physical swatch coverage and library
- `/color-mixing/library/new` — record a physical swatch
- `/sessions` — painting-session library
- `/sessions/new` — start painting
- `/settings/usage` — generation usage
- `/internal/design-system` — approved live interface reference

Old supported `/?view=…` bookmarks redirect to durable routes.

## Quality commands

Backend commands run from `apps/api` with the project environment; frontend commands run through the
scripts in `apps/web/package.json`. The acceptance bar is backend format/lint/type/tests, frontend
lint/type/tests/build, static-budget validation, Playwright critical flows, migration upgrade, legacy
data-retention verification, and healthy Compose services.

## Repository map

```text
apps/api/       FastAPI, worker, models, migrations, and tests
apps/web/       React application, static artwork, and browser tests
docs/           Product, architecture, audit, decisions, and protected contracts
compose.yaml    Local service topology
CODEX.md        Stable implementation brief
```

The current product boundary is [ADR 0005](docs/decisions/0005-watercolor-first-consolidation.md).
