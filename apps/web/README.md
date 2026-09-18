# Wanderline web

React/Vite frontend using query-based views for Explore, teaching guides, Feeling First,
Color Study, painting sessions, lesson creation and review, watercolor lessons, and settings.
Curated artwork is local; saved lessons and generation use the API.

## Application design reference

Read [the Garden Studio contract](../../docs/DESIGN_SYSTEM.md) for interface design and copy.
Run `npm --prefix apps/web run dev -- --host 127.0.0.1 --port 4173` from the repository root,
then open [the live reference](http://localhost:4173/?view=design-system). It uses local examples
and is intentionally absent from everyday navigation. It is the approved reference for
application-wide reuse; preserve its documented protected exceptions.

## Local checks

```sh
npm install
npm run typecheck
npm test
npm run lint
npm run build
npm run check:static
npm run test:e2e
```

Vite writes the frontend build to `dist`.
