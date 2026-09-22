# Wanderline Documentation Guide

Status: Current
Authority: Documentation map and context-loading policy
Last reviewed: 2026-09-20

## Read for every task

- `CODEX.md` — stable implementation contract and working rules
- `README.md` — current product and run instructions
- `docs/PROJECT_STATE.md` — current milestone, approvals, blockers, and next tasks
- `docs/FEATURE_API_AUDIT.md` — authoritative feature/API disposition and legacy removal record
- `docs/FEATURE_IDEAS.md` — explicitly separate backlog ideas, including physical color validation
- This file — choose the smallest relevant context tier

## Read for product work

- `docs/PRODUCT.md`
- `docs/ROADMAP.md`

## Read for architecture work

- `docs/ARCHITECTURE.md`
- `docs/decisions/0005-watercolor-first-consolidation.md`
- Relevant files in `docs/decisions/`

## Read for feature work

- The feature-specific document
- Relevant ADRs
- Relevant records in `docs/UI_REGRESSIONS.md`

The current physical-swatch contract is `docs/COLOR_LIBRARY_V1.md`.

## Read for visual or generated-artifact work

- `docs/DESIGN_SYSTEM.md` for application UX, styling, and interface copy; inspect the live
  `/internal/design-system` reference. This is separate from the artwork teaching style guides.
  Shared production styling lives in `apps/web/src/garden-application.css`; its responsive
  and protected-selector checks live in `apps/web/e2e/garden-adoption.spec.ts`.
- `docs/UI_REGRESSIONS.md` for permanent UI invariants
- The relevant review document
- The relevant style-guide or prompt record
- `docs/PROJECT_STATE.md` for approval and revision state

## Document status vocabulary

- `Current` — authoritative and actively maintained.
- `Reference` — useful background, but not the final authority.
- `Historical` — preserved for context and not an implementation driver.
- `Pending review` — proposed or awaiting approval.

## Historical or superseded material

Read clearly marked historical material only when investigating why a decision changed or when
compatibility requires it. Do not load every document by default.

- `docs/APPLE_RECIPE_REVIEW.md` — completed review record for the frozen Simple Recipe v1 reference
- `docs/CHAT_HANDOFF.md` — historical implementation handoff; current state lives in PROJECT_STATE
- ADRs 0001–0004 — historical decisions retained where compatibility or frozen contracts require them
