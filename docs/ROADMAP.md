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

### Simple Recipe v2: simplicity-first generation and guided recovery

Simple Recipe v1 remains frozen. Any generation-contract change below ships as a separately
versioned Simple Recipe v2 after fixture, print, accessibility, and visual review.

- Make simplicity the primary image objective rather than direct photographic realism: retain the
  subject's identity while grouping petals, foliage, vessels, shadows, and background into broad,
  paintable shapes.
- Constrain likely failure points in the prompt and validator: limited wash families, few interior
  boundaries, plain vessel treatment, restrained texture/highlights, and omission of decorative
  motifs that do not carry the subject.
- Separate hard structural failures (missing/equal panels, unusable outline, non-corresponding
  composition) from complexity advisories. Structural failures still require review; complexity
  alone should not hide a paid candidate or prevent the learner from accepting it.
- Preserve every completed paid candidate as a visible, reusable draft with its validator category,
  while keeping raw evaluator prose in logs rather than application copy.
- Add user-triggered, category-specific regeneration procedures such as “simplify small shapes,”
  “align the outline,” and “quiet the background.” Feed the relevant evaluator findings into the
  corrective prompt, show that another generation may add usage, and never retry automatically.
- Measure acceptance, regeneration category, and repeat-failure rates before tightening validation.

Definition of done: a v2 contract and fixtures prove that accepted references remain recognizable,
beginner-paintable, and structurally usable; recovery stays concise and every additional paid call
requires an explicit learner action.

### P2: Generated references

- Rename Sessions to References throughout navigation, application copy, durable routes, API
  contracts, persistence, and usage reporting.
- Preserve existing IDs and generated assets through a data-preserving migration; redirect
  `/sessions/...` bookmarks to matching `/references/...` routes with query parameters intact.
- Keep `/api/v1/painting-lessons` as a deprecated alias for one compatibility release while
  `/api/v1/references` becomes canonical.
- Preserve generation recovery, editing, discard/restore, permanent deletion, and usage history.

### P3: Painting journal foundation

- Allow multiple dated painting attempts per generated reference.
- Store automatic timestamps, an editable `painted_on` date, notes, normalized free-form tags,
  one primary artwork photo, and optional process/detail photos.
- Add reference-scoped journal collection APIs and entry-scoped read/update/delete and image
  management APIs with optimistic revision checks and learner isolation.
- Preserve original uploads privately and serve normalized display derivatives. Prepare the data
  for a later gallery ordered by painted date and filterable by reference and tags; do not build
  the gallery presentation in this stage.

- A physical color-testing workflow where the learner records real mixes, uploads or samples the
  dried result, and compares the resulting color with the authored target before publishing a new
  validated catalog version
- Additional watercolor palettes
- A new medium introduced through explicit versioned contracts and design review
- Stronger local identity only when multi-learner use becomes a real requirement
