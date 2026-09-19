# Delivery Roadmap

Status: Current
Authority: Delivery sequencing
Last reviewed: 2026-09-18

## Release 1: Evidence-backed audit — complete in consolidation

- Inventory every user surface, route, FastAPI operation, table, worker operation, storage type,
  test group, and documentation claim.
- Record baseline health and tests.
- Accept the watercolor-first product boundary in ADR 0005.
- Resolve current-document contradictions and identify unimplemented promises.

Definition of done: `docs/FEATURE_API_AUDIT.md` is mechanically checked against routes, models, and
worker operations and is the authoritative removal ledger.

## Release 2: Unified application and deprecations — complete

- Action-first Home and shared Home / Explore / Sessions / Color Mixing shell
- Durable routes with compatibility redirects for supported `?view=…` bookmarks
- Production versioned color-mixing catalog and learner-scoped trials
- Deprecated OpenAPI flags, response header, and structured endpoint usage logs
- Read-only legacy export command and idempotent color recipe seeding
- Removal of proven-unreferenced legacy site bundles and obsolete current claims

Definition of done: all retained flows pass backend/frontend/static/browser acceptance; Simple Recipe
and Feeling First regressions remain unchanged; Compose is healthy.

## Release 3: Confirmed legacy removal — complete

The owner confirmed this remains a single-user local application with no unknown consumers. A real,
Git-ignored export was verified before removal.

- Add the Alembic migration dropping `exercises`, `practice_sessions`, `library_exercises`,
  `library_attempts`, `sketches`, and `analyses`.
- Retain `learner_profiles`, painting tables, generation usage, color recipes, and color trials.
- Remove deprecated handlers, services, schemas, seeds, models, compatibility tests, and legacy
  storage objects.
- Verify upgrade from the current schema and dry-run object cleanup before deletion.

Definition of done: retained painting/color data survives migration; export and cleanup manifests
reconcile; no deprecated operation remains in OpenAPI.

## Later opportunities

- A physical color-testing workflow where the learner records real mixes, uploads or samples the
  dried result, and compares the resulting color with the authored target before publishing a new
  validated catalog version
- Additional watercolor palettes
- A new medium introduced through explicit versioned contracts and design review
- Stronger local identity only when multi-learner use becomes a real requirement
