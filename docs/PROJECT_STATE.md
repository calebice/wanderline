# Wanderline Project State

Status: Current
Authority: Volatile project coordination state
Last reviewed: 2026-09-21

## Current milestone

The watercolor-first consolidation release is implemented. Wanderline now has an action-first Home
with a manual horizontal carousel of completed generated references,
durable path-based routes, shared primary navigation, production color mixing, and an instrumented
painting-session workflow. ADR 0005 and `FEATURE_API_AUDIT.md` are authoritative.

Release 4 adds a learner-private Personal Color Library. It records single paints, authored mixes,
and custom mixes of up to three palette paints with numeric parts, paper/capture metadata, guided
observations, and one private card-backed dried-swatch photograph. Existing persistence/API trial
names remain compatible while application copy calls those working records mix notes.

Garden Studio revision 04 remains approved. Paper A and Pigment edge controls may be reused without
additional approval. The complete Feeling First selector and Simple Recipe v1 presentation/content/
assets/printing remain protected and frozen.

Rejected Simple Recipe previews now remain visible and can be accepted without paying to regenerate.
The application shows concise review categories rather than raw evaluator prose. A separately
versioned simplicity-first generation and guided-regeneration proposal is recorded in the roadmap.

## Current product truth

- Wanderline is a watercolor-first, medium-extensible painting studio for one local learner.
- Starting or resuming a painting session is the primary journey.
- Explore, style references, Feeling First, Color Study, lemon lesson, saved sessions, Simple Recipe,
  usage, and provider/storage/worker boundaries are retained.
- Color mixing is production functionality: 36 versioned Emily Lex starting recipes plus saved
  learner trials, notes, and adjustment history. Recipes remain illustrative until physical review.
- Drawing curriculum, exercises, progress, practice/library attempts, critique, decomposition, and 3D
  are retired—not hidden future features.
- Their records were exported and their APIs, runtime code, seeds, models, tests, and tables removed.

## Removal status

Complete. The verified private export contains 12 exercises and 20 library exercises, with no user
attempts, practice sessions, sketches, analyses, or private sketch objects. Migration `0014` removes
only the six drawing-era tables and preserves `learner_profiles` plus all painting/color data.

## Verification baseline

Before consolidation: healthy Compose services, 91 backend tests, 38 frontend tests, and passing
frontend type checks.

## Consolidation verification

September 18: backend lint, formatting, strict types, and **69 retained tests** pass. Frontend lint,
types, **46 unit tests**, production build, and static validation pass (86 files, 17.6 MB). All **41
Playwright tests** pass across the reference-carousel Home, production color trials, clean/compatibility routes, responsive
and enlarged-text layouts, Feeling First preservation, and frozen Simple Recipe/print screenshots.

Compose rebuilt successfully with all six services healthy and PostgreSQL at Alembic `0015`. Sessions
can be discarded, restored, or explicitly deleted forever. The live catalog returns 36 versioned
recipes, and removed drawing-era operations are absent from OpenAPI.

## Color Library verification

September 20: backend format/lint/strict types and **73 tests** pass. Frontend lint/types,
**48 unit tests**, production build, and static validation pass. All **42 Playwright tests** pass,
including card-backed swatch capture, reopen, coverage updates, three responsive viewports, and 200%
text alongside every protected Feeling First and Simple Recipe regression. Migration `0015` is
additive and the API audit includes every swatch route, table, and private storage type.

Release acceptance remains pending hands-on mobile confirmation. Review the direct-from-phone camera
workflow and judge whether the capture form is manageable while working with a physical swatch and
reference card. The responsive browser checks pass, but they do not substitute for testing camera
selection, photograph handoff, and form burden on an actual phone. Keep the current implementation
staged for review; if the mobile form feels overwhelming, revise its presentation without weakening
the capture contract.

## Canonical documents

- Product boundary: `docs/decisions/0005-watercolor-first-consolidation.md`
- Disposition/removal ledger: `docs/FEATURE_API_AUDIT.md`
- Product requirements: `docs/PRODUCT.md`
- Architecture: `docs/ARCHITECTURE.md`
- Delivery sequence: `docs/ROADMAP.md`
- Interface contract: `docs/DESIGN_SYSTEM.md`
- Simple Recipe v1: `docs/SIMPLE_RECIPE_V1.md`
- Regression invariants: `docs/UI_REGRESSIONS.md`

## Next product exploration

Define a separately reviewed color-recommendation contract: supported reference-card calibration
profiles, target-color sources, match scoring, confidence, and acceptable accuracy. The Color Library
preserves originals and card identity for that work but makes no calibration or recommendation claim.
