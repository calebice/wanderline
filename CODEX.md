# Codex Implementation Brief

Status: Current
Authority: Stable implementation contract and working rules
Last reviewed: 2026-09-20

Wanderline is a containerized, watercolor-first and medium-extensible painting studio. Treat this
file, ADR 0005, and `docs/FEATURE_API_AUDIT.md` as the product boundary.

## Objective

Help one local learner start or resume a painting, approve its target, follow and edit generated
guidance, save the session, explore authored references, and keep useful color-mixing trials.
Watercolor is the only production medium in this release. Names and versions must permit later media.

## Production scope

- Action-first home, exploration, style guides, Feeling First, Color Study, and canonical lemon lesson
- Painting-session creation, private references, target approval, durable generation, editing, saving,
  reopening, Simple Recipe, and usage reporting
- Versioned Emily Lex color-mixing catalog with learner-scoped trials, notes, ordered adjustments,
  optimistic revisions, and an explicit illustrative-not-physically-validated label
- Learner-private Personal Color Library with card-backed physical single-paint and mixture swatches,
  immutable source snapshots, structured observations, and private original/display photographs
- Browser, API, worker, PostgreSQL, Redis, private object storage, provider, health, and future identity
  boundaries

Use “painting session” in user-facing text. Keep “lesson” in existing API and persistence identifiers
where compatibility requires it.

## Retired scope

Drawing curriculum, generic exercises, practice sessions, library attempts/digital exports, progress
scores, sketch critique, image decomposition, and 3D studio/configuration are not product features.
Their records were exported and their APIs, runtime code, models, seeds, and tables were removed in
migration `0014`. Do not reintroduce them without a new product decision.

Prompt-generation, recommendation, presigned-upload, and 3D endpoints are not implemented contracts.
Do not present them as current or planned MVP functionality.

## Invariants

- Garden Studio revision 04 (paper A and Pigment edge controls) is authoritative.
- Preserve the complete Feeling First selector: appearance, slider, labels, sticky placement, and
  scrolling behavior.
- Preserve Simple Recipe v1 presentation, content contract, assets, and printing. Behavioral changes
  require a new version.
- Generated targets require explicit approval before full guidance generation.
- Saved versioned snapshots must remain readable after provider or catalog changes.
- Historical migrations are immutable. Retain `learner_profiles`, which owns painting sessions and
  color trials.
