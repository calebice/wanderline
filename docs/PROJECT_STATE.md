# Wanderline Project State

Status: Current
Authority: Volatile project coordination state
Last reviewed: 2026-09-09

## Current milestone

The apple recipe template and the pear, single daisy, plain mug, and side-view bird examples are
approved. Simple Recipe v1 has a frozen reference fixture, versioned generation contracts, and
visual regressions. See `docs/SIMPLE_RECIPE_V1.md`.

## Current product truth

- Wanderline is a calm, paper-first drawing studio for beginners.
- The guided practice loop remains the primary product journey.
- Sketch critique and photo-to-lesson creation are optional tools.
- Local analysis is descriptive and uncertainty-aware; it is not an objective art grade.
- Curated style references are static, authored frontend content.
- Generated lesson artwork requires explicit preview approval before guidance generation.

## Recently completed

- Photo-to-lesson creation, editing, saving, reopening, and generation accounting.
- Simple recipe support with 1–6 instructions, compact everyday color labels, optional finishing guidance, and local outline print sizing.
- Curated five-style reference guide and responsive process sheets.
- Local geometric image breakdown and bounded synchronous sketch analysis.

## Acceptance complete

- Apple template and pear, daisy, mug, and bird recipes accepted by the user.
- Mug and bird saved at revision 4 with approved content unchanged.
- Removed the redundant “Your finished painting” caption from generated simple recipes.
- No remaining subject approval gates for this pass.

## Canonical artifacts

- Product requirements: `docs/PRODUCT.md`
- Architecture: `docs/ARCHITECTURE.md`
- Delivery plan: `docs/ROADMAP.md`
- Photo-to-lesson workflow: `docs/PHOTO_TO_LESSON.md`
- Simple recipe decision: `docs/decisions/0004-simple-painting-recipes.md`
- Historical apple review record: `docs/APPLE_RECIPE_REVIEW.md`
- Regression register: `docs/UI_REGRESSIONS.md`

## Active architectural/product decisions

- Keep browser, API, worker, PostgreSQL, Redis, and object storage behind explicit boundaries.
- Keep local sketch analysis bounded, deterministic, and synchronous for the current slice.
- Keep curated style content typed, static, and versioned with the frontend.
- Keep simple recipe generation compact, approval-gated, idempotent, and backward compatible.

## Verification status

September 10: 91 backend tests, 28 frontend tests, 21 browser tests, lint/type checks,
backend formatting, production build, and static validation pass. Approved desktop/phone
screenshots and the print modal are protected by visual regression tests. The reviewed subject
set completed human approval without changing the frozen v1 contract.

## Recommended next task

Use the frozen reference and regression checks for future Simple Recipe changes. Introduce a new
recipe version for behavior that would change the approved v1 contract.
