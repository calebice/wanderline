# Personal Color Library v1

Status: Current
Authority: Physical swatch product and data contract
Last reviewed: 2026-09-20

## Purpose

The Color Library records how the local learner's watercolor paints and mixtures look after they
dry. A **swatch** is physical evidence with a private card-inclusive photograph. Existing
`color_mix_trials` remain working **mix notes** in application copy and are not swatches.

The library prepares trustworthy source material for a later recommender. Version 1 does not sample
pixels, calibrate photographs, rank matches, mark formulas validated, or publish catalog revisions.

## Sources and formula

- `single_paint` uses exactly one paint from the versioned Emily Lex 18-color palette and one part.
- `catalog_mix` snapshots an authored recipe and records positive numeric parts for exactly its paints.
- `custom_mix` records two or three distinct paints from the palette and has no authored target.
- Multiple swatches may use the same source so paper, formula, capture conditions, and repeated results
  remain distinct.

Every record owns an immutable source snapshot, formula, paper, capture metadata, observations,
test date, revision, and timestamps. Metadata and the photograph can be corrected using optimistic
revisions; permanent deletion removes both private image objects.

## Capture contract

One supported image is required. Preserve the original upload and serve a bounded WebP display copy.
The learner records the reference-card brand and model, selects the lighting condition, and confirms
that the fully dry swatch and full card are visible on the same plane in even light without glare or
cast shadow. Version 1 trusts this confirmation and performs no card detection or color extraction.

Required appearance observations are value, temperature, and chroma. Transparency, granulation,
lifting/staining behavior, water, drying, and free-form notes are optional. Single-paint and authored
mix swatches additionally record a guided comparison with the illustrative screen target.

## Experience contract

The durable library lives below `/color-mixing/library`. Its first section reports how many of the 18
single paints have at least one physical swatch. A newest-first gallery follows with source, family,
and ingredient filters. The mixing workbench links to the library and can begin a catalog-mix swatch
from the active recipe.

Use the approved Garden Studio collection, artwork, and form patterns. Important swatch photographs
remain uncropped, all fields reflow at enlarged text, and the Feeling First and Simple Recipe v1
contracts remain untouched.
