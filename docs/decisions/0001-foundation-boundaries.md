# ADR 0001: Foundation boundaries

Status: Accepted

## Context

The first Wanderline slice needs durable exercises and practice sessions while remaining a
standalone, container-first service that Terminus can configure and route.

## Decision

- Keep the browser, API, worker, PostgreSQL, Redis, and S3-compatible storage as separate services.
- Keep route handlers thin: repositories perform queries and services own session creation rules.
- Use UUID database primary keys while exposing stable exercise slugs in the HTTP contract.
- Run idempotent migrations and seed insertion before the API starts.
- Read public API and router base paths from build/runtime environment variables.
- Keep Redis, MinIO, and the worker running but defer their application behavior until the upload slice.

## Consequences

The foundation preserves the intended service boundaries without prematurely implementing upload or
analysis behavior. API startup intentionally fails if migrations or seeds cannot reach PostgreSQL.
