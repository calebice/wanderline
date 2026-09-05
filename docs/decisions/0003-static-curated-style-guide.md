# ADR 0003: Replace the exercise-based Style Lab with a static curated guide

## Status

Accepted

## Context

The first Style Lab modeled style as seven adjustable tokens applied to four SVG objects. Although
the system was deterministic and interactive, it did not answer the learner's primary question:
what would a complete subject look like when drawn through several familiar visual languages, and
how could they make a credible version themselves?

The replacement required human-reviewed visual references, clear process instruction, offline
availability, and no dependency on generative inference at runtime.

## Decision

Ship five curated style entries as a typed frontend catalog. Each entry owns an original finished
reference, a simplified learner reference, a four-panel process sheet, visual-decision guidance,
four drawing steps, materials, mistakes, and accessible descriptions. Assets are versioned with the
web application. Thumbnails are precached; full images are cached after viewing.

Remove style missions from the Exercise Library and remove recipe, passport, recommendation,
artifact-upload, and remix APIs. Migration `0008` deletes the obsolete attempts and exercises and
drops the two Style Lab tables. Migration `0007` remains in history; downgrade recreates only its
empty schema.

## Consequences

- The guide is fast, deterministic, reviewable, and available without the API.
- Visual quality and instructional sequencing are explicitly approved before shipping.
- Learner-specific recipes and before/after artifacts are no longer stored.
- New styles require authored assets and catalog content rather than a new renderer token.
- A future dedicated Anime Style Explorer can expand the broad environment entry without treating
  anime as a single fixed visual category.
