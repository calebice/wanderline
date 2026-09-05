# Wanderline Style Studio

A static, Sites-native reference studio for exploring how subject, drawing language, and composition change an image. The production app contains three source-controlled experiences:

- A 5 × 5 subject and style comparison at `/`
- Five long-form teaching guides at `/?view=guide&style=realism`
- Feeling First at `/?view=feeling-first&emotion=pensive`

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

The Sites manifest is in `.openai/hosting.json`; Vite writes the static deployment to `dist`.
