# Pendargan Survey Runtime

A new Angular runtime for rendering and executing PendarGan surveys. This repository is the working area for a controlled rewrite of the public voting client.

> **Status:** rewrite foundation / legacy behavior discovery. The existing application is preserved as the compatibility reference; the new runtime must not replace it until behavioral parity and performance gates pass.

## Goals

- Evaluate survey rules incrementally instead of repeatedly scanning every question and option.
- Keep survey definitions, answers, visibility, navigation, and rendering as separate concerns.
- Load only the question renderer chunks required by the current survey.
- Preserve the existing API contract and answer serialization until an explicit compatibility migration is approved.
- Make the work reproducible for both human developers and AI coding agents.

## Current stack

- Angular 22, TypeScript 6, standalone components and native control flow.
- `ngx-exp-parser` for expression parsing/evaluation and Angular reactive-model support.
- `ngx-kit` for shared UI utilities.
- Vitest through Angular's unit-test builder.

## Start

```bash
npm ci
npm start
npm test
npm run build
```

The current start script uses local SSL configuration referenced by `angular.json`; if those certificate files are not available in your checkout, use `npx ng serve --port=4444` or configure local certificates.

## Documentation

- [Current status](docs/ai/CURRENT-STATUS.md)
- [Next steps](docs/ai/NEXT-STEPS.md)
- [Architecture overview](docs/architecture/OVERVIEW.md)
- [Dynamic question renderers](docs/architecture/DYNAMIC-QUESTION-RENDERERS.md)
- [Legacy behavior inventory](docs/analysis/LEGACY-SYSTEM.md)
- [Compatibility matrix](docs/analysis/COMPATIBILITY-MATRIX.md)
- [Roadmap](docs/development/ROADMAP.md)
- [Task board](docs/development/TASKS.md)
- [Decision records](docs/development/DECISIONS.md)
- [AI handoff](docs/ai/HANDOFF.md)

## Non-goals for the first milestone

- Rewriting backend APIs or generated API proxies.
- Changing persisted answer formats without a migration/compatibility plan.
- Implementing every question renderer before the runtime contracts are stable.
- Claiming performance improvements without a repeatable baseline and benchmark.

## Working rule

The legacy implementation is evidence, not a specification by itself. For every behavior, record the observed code path, verify it against representative production survey payloads, and add a regression test before changing it.
