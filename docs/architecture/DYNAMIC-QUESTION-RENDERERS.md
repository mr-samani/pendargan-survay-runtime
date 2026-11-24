# Dynamic question renderers

## Decision

Use a finite, explicit registry of question-type IDs to dynamic-import loader functions. Keep this registry separate from the expression/runtime core.

The existing `definitions.ts` already uses dynamic imports for three types. Preserve the direction, but replace the weak `Type<any>` map with a typed renderer contract and robust loading/error behavior.

## Why it helps

A static import of every renderer from the runtime entry point can pull all renderer code into the initial dependency graph. A dynamic `import()` creates a bundler split point. If a survey only needs a subset of types, only those renderer chunks should need to be fetched.

This does **not** guarantee that all bytes disappear from the initial bundle:
- shared dependencies may be hoisted into initial or shared chunks;
- a renderer may import a large shared module;
- a bundler can merge chunks depending on build configuration;
- the first screen may request several types at once;
- preloading policy changes network timing.

Therefore the acceptance test is the actual production build: initial JS bytes and per-type lazy chunk bytes must be reported.

## Proposed contract

A renderer definition should include:
- stable question type ID;
- lazy loader returning the renderer component;
- optional preload policy;
- schema/version metadata if renderer-specific settings need validation;
- optional capability metadata (e.g. supports children, files, matrix rows).

The host should pass a normalized immutable question definition and a runtime question-instance facade, not the entire mutable engine/service. A renderer emits typed user actions; the runtime owns answer mutations.

## Loading behavior

1. Inspect the survey definition and collect unique renderer type IDs.
2. Validate all IDs against the registry before starting the survey.
3. Load only renderers required by the selected survey or current page, depending on UX/network trade-offs.
4. Cache each in-flight Promise and resolved component by type ID.
5. Load different required renderers concurrently with `Promise.all`, not by awaiting each question serially.
6. Preserve a stable loading/error state per type.
7. Never evaluate arbitrary module paths or import specifiers received from the server.

## Security and extensibility

Server payloads may select only registered numeric/string type IDs. They must not provide a JavaScript import path, module URL, class name, or executable code. Custom renderers should be registered by trusted application code at build time or through a separately reviewed plugin mechanism.

## Rollout

- Keep the current `NgComponentOutlet` host initially.
- Introduce a typed registry and loader cache.
- Add tests proving only requested loaders execute, repeated requests share a Promise, and unknown IDs return a structured unsupported-type error.
- Measure initial bundle and lazy chunks before/after.
- Migrate each question renderer independently and compare answer payloads.

## Current implementation observation

`projects/vote/src/app/questions/definitions.ts` currently defines loaders for HtmlFrame, UniqueSelect, and MultiSelect. `VoteService.iniitlizeQuestions()` awaits `loadComponent()` inside a sequential loop. Dynamic import already gives the bundler split points, but the loader orchestration can be made concurrent after survey-wide type validation.
