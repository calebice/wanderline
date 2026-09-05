# 0002: Bounded synchronous local sketch analysis

## Status

Accepted for the first sketch-analysis vertical slice.

## Context

The product needs useful feedback when no external vision model is configured. Uploads must
remain private, container-first, and compatible with Terminus-provided PostgreSQL and
S3-compatible storage. A production queue is planned, but introducing retry and job-state
semantics before a complete upload-to-feedback path would expand this slice substantially.

## Decision

The API validates JPEG and PNG signatures, byte size, decoded pixel count, and dimensions
before storing an original in S3-compatible storage. It then runs a deterministic local
computer-vision provider within the request and stores both metadata and structured results
in PostgreSQL.

Synchronous work is bounded by `MAX_UPLOAD_BYTES` and `MAX_IMAGE_PIXELS`. The provider reports
observable image measurements and uncertainty-aware coaching language. It does not claim to
score artistic quality or identify the subject. An optional user-provided subject is stored
as context. That declared context may select an explicit, versioned coaching rubric—for example,
whole-image centerline and mirror checks for a frontal guitar—but it must not be presented as
semantic part detection. Penmanship and focus scores retain their source measurements,
confidence, calculation version, and limitations in the response.

The provider and storage logic remain behind service boundaries so analysis can move to the
existing worker without changing the public result contract.

## Consequences

- A user receives immediate feedback without external credentials.
- Originals do not depend on container filesystem persistence.
- Large or invalid files are rejected before storage.
- Request latency grows with accepted image size.
- Analysis retries, thumbnails, session association, history retrieval, semantic critique,
  and subject prediction remain future work.
