# ADR 0005: Watercolor-first product consolidation

Status: Accepted
Date: 2026-09-18

## Context

Wanderline accumulated two products: an early drawing curriculum and a later, substantially more
complete photo-to-watercolor studio. The drawing dashboard, exercises, progress scoring, critique,
geometric decomposition, and 3D promises no longer had a coherent user journey or an active web
consumer. Meanwhile, painting-session creation, approval, generation, editing, saving, style
exploration, Feeling First, Color Study, and Simple Recipe formed a usable application.

Leaving both product stories marked current made the interface, API, and documentation disagree.
Immediate destructive removal would also be unsafe for existing local records and private objects.

## Decision

Wanderline is a watercolor-first, medium-extensible painting studio. Watercolor is the only
production medium in this release; identifiers and catalog versions must not prevent a later medium.

- The primary journey is start or resume a painting session.
- Exploration, Feeling First, Color Study, the canonical lemon lesson, Simple Recipe v1, usage,
  health, worker, provider, storage, and future identity boundaries are retained.
- Color mixing is production functionality with a versioned authored catalog and learner-scoped
  trials. Recipes are explicitly illustrative until physically validated.
- Drawing curriculum, generic exercises, practice sessions, library attempts/exports, progress
  scoring, sketch critique, geometric decomposition, 3D configuration, and the generic image alias
  are retired.
- Retired HTTP operations remain behavior-compatible for one consolidation release. They are marked
  deprecated in OpenAPI, return `Deprecation: true`, and emit structured usage logs.
- Removal is a separate release gated by a successful export dry-run and evidence that no unknown
  consumer remains. Historical migrations remain immutable.
- `learner_profiles` remains because painting sessions and color-mixing trials use it.

The approved Garden Studio revision 04 remains the interface contract. The complete Feeling First
selector and Simple Recipe v1 presentation, content, assets, and printing remain frozen.

## Consequences

The product has one shell and durable path-based routes. Persistence still uses “lesson” where
compatibility requires it, while user-facing copy says “painting session.” New color trials snapshot
their recipe and catalog version so future catalog changes do not make history unreadable.

The deprecated implementation temporarily remains larger than the product. This is intentional and
measurable; `docs/FEATURE_API_AUDIT.md` is the removal ledger and the legacy export command is the
safety gate.

## Implementation outcome

The compatibility window closed on 2026-09-18 after the owner confirmed there were no other local
consumers and a real export was verified. Migration `0014` removes the six retired tables; the API,
services, schemas, seeds, models, and compatibility tests were removed with them. Historical
migrations and the private Git-ignored export remain the recovery path.
