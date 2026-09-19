# Product Requirements

Status: Current
Authority: Product requirements
Last reviewed: 2026-09-18

## Product promise

Wanderline is a calm, watercolor-first painting studio. It helps a learner begin or resume a painting,
turn a photo or idea into an approval-gated painting session, explore authored visual references, and
remember what worked when mixing color.

The first release is optimized for one local learner while preserving ownership boundaries for future
identity. Watercolor is the only production medium; domain names and versions must allow later media.

## Primary journey

1. Open Home and choose a completed painting reference from the manual carousel, continue preparing
   unfinished work, or use the dominant **Start painting** action.
2. Begin from a private photo or supported idea, with calm defaults and optional choices.
3. Review and explicitly approve the generated target.
4. Prepare, review, and edit the painting steps.
5. Paint from the session or Simple Recipe and save it for later.
6. Use Explore, Feeling First, Color Study, and Color Mixing when seeking direction.

## Production capabilities

- Action-first Home with a newest-first generated-reference carousel and durable session URLs
- Static authored style references and five teaching guides
- Frozen Feeling First interaction and canonical lemon watercolor lesson
- Color Study for local, illustrative color relationships
- Private photo-to-painting-session workflow with provider-backed generation and retry
- Saved sessions, optimistic editing, Simple Recipe v1, tracing/print, and usage reporting
- Versioned Emily Lex color catalog with 36 authored starting recipes
- Learner-scoped color trials with ordered adjustments, notes, revision, and history

Every color recipe must say that screen swatches and directions are illustrative starting points. Do
not imply guaranteed physical outcomes until paint/paper testing is recorded.

## Success criteria

- A learner can paint from a ready reference, continue preparing unfinished work, or start a new
  painting from Home in one clear action.
- Bookmarked sessions and exploration selections survive the clean-route migration.
- A generated target is never mistaken for approved guidance.
- Saved painting sessions and color trials reopen with the version that created them.
- Empty, loading, failure, phone, tablet, desktop, enlarged-text, and keyboard states remain usable.
- The stack starts healthily with one Compose command and no browser-held infrastructure credentials.

## Non-goals

- Drawing curriculum, generic exercises, progress/talent scoring, or adaptive practice recommendations
- Sketch critique, image decomposition, or digital drawing exports
- Production 3D scene/model configuration
- Full-featured digital painting, accounts/social features, marketplaces, or collaboration
- Guaranteed color matching or automatic recipes inferred from screen colors
- Changes to frozen Simple Recipe v1 or the Feeling First selector

Drawing-era APIs and persistence have been removed after export; they are not product capabilities.
See `docs/FEATURE_API_AUDIT.md`.
