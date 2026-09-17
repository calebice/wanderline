# Wanderline Documentation Guide

Status: Current
Authority: Documentation map and context-loading policy
Last reviewed: 2026-09-10

## Read for every task

- `CODEX.md` — stable implementation contract and working rules
- `README.md` — current product and run instructions
- `docs/PROJECT_STATE.md` — current milestone, approvals, blockers, and next tasks
- This file — choose the smallest relevant context tier

## Read for product work

- `docs/PRODUCT.md`
- `docs/ROADMAP.md`

## Read for architecture work

- `docs/ARCHITECTURE.md`
- Relevant files in `docs/decisions/`

## Read for feature work

- The feature-specific document
- Relevant ADRs
- Relevant records in `docs/UI_REGRESSIONS.md`

## Read for visual or generated-artifact work

- `docs/DESIGN_SYSTEM.md` for application UX, styling, and interface copy; inspect the live
  `?view=design-system` reference. This is separate from the artwork teaching style guides.
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
