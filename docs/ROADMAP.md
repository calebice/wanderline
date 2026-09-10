# Delivery Roadmap

Status: Current
Authority: Delivery sequencing
Last reviewed: 2026-09-09

## Milestone 1: Runnable foundation

- Monorepo
- Docker Compose
- API health checks
- Web shell
- PostgreSQL migrations
- Seed data
- CI workflow
- Basic 3D cube

Definition of done: one command starts a healthy local stack.

## Milestone 2: Four-week beginner habit pilot

- Twelve ordered visual micro-lessons across four beginner milestones
- One seeded local learner and durable progress
- Dashboard with one recommended lesson and a flexible three-session weekly goal
- Full path view with skippable, replayable lessons
- Active session restoration and a gentle phased timer
- Difficulty reflection, optional takeaway, and a simpler replay after “too hard”
- Embedded 3D references for form, perspective, construction, and value lessons

Definition of done: a returning beginner always sees one clear next lesson, can finish it on paper in about 15 minutes, and sees their milestone progress persist.

## Milestone 3: Optional sketch critique

- Presigned uploads
- Image records
- Worker queue
- Thumbnail generation
- Local CV metrics
- Results screen
- Safe, uncertainty-aware critique language

Definition of done: a user can request local feedback without critique becoming a course gate or altering curriculum progress.

## Milestone 4: Reference studio expansion

- Reusable scene-study contract for 3D and authored-image sources
- Predict, reveal, draw, and compare learning loop
- Composition, shape-mass, perspective, primitive, measurement, lighting, and reconstruction overlays
- Per-scene saved progress and a final redraw-from-memory prompt
- Primitive chooser
- Camera modes
- Lighting controls
- Wireframe and edges
- Grid and ground plane
- Capture current view
- STL, OBJ, and glTF import

Definition of done: embedded lesson references and the optional studio can create useful form studies without external software.

## Milestone 5: Evidence-based adaptation

- Reflection patterns and lesson replay history
- Milestone and work-history views
- Transparent recommendations beyond the earliest incomplete lesson
- Flexible weekly rhythm without streak penalties
- Skill-specific evidence without talent scores
- Redraw comparison

Definition of done: the app recommends an explainable next exercise based on recent work.

## Milestone 6: Curated style reference guide

- Five original interpretations of a fictional Japanese coastal setting: realism, cartoon,
  architectural drawing, watercolor, and anime environment art
- A finished showcase and simplified learner reference for every style
- Four-stage process sheets with equivalent written descriptions
- Practical guidance for structure, line, value, color, medium, texture, and detail
- Responsive gallery and detail routes with accessible fallbacks and offline image caching
- Research matrices, prompt summaries, and explicit human approval history stored with the project

Definition of done: a learner can identify the visible decisions behind each broad style, choose an
attainable reference, and follow four concrete stages to make a study without a score or runtime
generation dependency.

## Later opportunities

### Photo-to-lesson workflow — delivered

- Creator flow with multi-photo upload, primary selection, HEIC handling, optional metadata, and
  an off-by-default study-image toggle
- Versioned `PaintingLessonV1` content model and additive migration `0009`
- Private S3 source/display assets, Redis-backed full/section jobs, worker retries, and structured
  failure logging
- Shared lemon/custom lesson renderer, editable review view, optimistic Save, and saved-lesson
  library

Definition of done: a learner can create, edit, save, and reopen a watercolor lesson from a photo;
the lemon lesson remains canonical content rendered by the same template.

- Style-differentiation pass for the shared coastal-stairway comparison: move beyond
  surface treatment by varying style-specific shape design, proportion, edge logic,
  value grouping, detail hierarchy, and medium behavior while preserving enough
  structural anchors for direct comparison
- Vision-language-model critique
- Semantic image construction overlays beyond the shipped local geometric breakdown
- Perspective-line detection
- Tablet stylus telemetry
- Stroke replay
- Goal-specific curricula
- Offline-first practice
- Optional private community groups
