# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 1 — immutable definition model and DTO compiler implemented and CI-green

## Repository facts

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in app is an Angular 22 application under `projects/vote`.
- Dependencies include `ngx-exp-parser@^1.0.2` and `ngx-kit@^9.5.2`.
- `FormQuestionTypesEnum` defines question type IDs 1–45 with gaps. The current renderer registry has loaders for only `HtmlFrame`, `UniqueSelect`, and `MultiSelect`.
- The API response includes separate collections for sections, questions, question options, expressions, and global variables.
- The API DTOs expose loop section metadata, expression target/action/scope enums, quota metadata, and answer/submission DTO shapes.
- The current `QuestionModel.canShow` computed invokes `checkOptionExpr()`, which mutates option state during derived evaluation. The rewrite must move these actions into explicit runtime transactions.

## Work completed on this branch

- Added project-specific architecture, legacy-analysis, compatibility, roadmap, task, testing, benchmark, and AI handoff documentation.
- Added typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Added CI workflow and repaired spec path aliases/stale starter tests.
- Added immutable definition types for sections, questions, options, expressions, and global variables.
- Added `compileSurveyDefinition()` to create a detached, frozen definition snapshot from the API response.
- The compiler preserves inactive definitions and expression metadata; it does not infer answer, visibility, navigation, or loop-instance semantics.
- The compiler reports missing question types, duplicate IDs, and snapshot-local fallback IDs as diagnostics.
- Added compiler tests for immutability, source isolation, deterministic ordering, missing types, duplicate IDs, and fallback identity.

## CI validation

<badge color="success">Latest CI passed</badge>

- Run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45379854623
- `npm ci`: passed.
- Production build: passed.
- Unit tests: 5 files, 12 tests passed.
- The first compiler test run caught a TypeScript strict index-signature assertion; the assertion was fixed and the complete CI run passed.

## Initial bundle snapshot

Measured by Angular 22 production build on GitHub Actions, Node 24.22.3:

| Chunk | Raw size | Estimated transfer |
|---|---:|---:|
| Initial total | 769.24 kB | 197.38 kB |
| MultiSelect | 6.72 kB | 1.96 kB |
| UniqueSelect | 6.26 kB | 1.94 kB |
| HtmlFrame | 418 B | 418 B |

The initial bundle exceeds the configured 500 kB warning budget by 269.24 kB. Angular also warns that `sanitize-html` is CommonJS. This is a measured baseline snapshot, not proof of the final achievable size or a full performance baseline.

## Expression library

- `ngx-exp-parser` PR #2 (bytecode engine and dependency analysis) is merged into `main` as of 2026-11-24.
- Merged PR: https://github.com/mr-samani/ExpParser/pull/2
- Merge commit: `597168c038d99fda3f81676a09c6cb7c6767855f`
- The app currently declares `ngx-exp-parser: ^1.0.2`. Verify the published npm artifact includes the merged implementation before relying on new public APIs.

## Remaining work

- Full production behavior inventory and anonymized fixtures.
- Verify every enum question type against actual production renderer/source availability.
- Trace expression initialization, action semantics, quotas, global variables, save/submit, and temporary-save flows.
- Expression source compilation and dependency graph.
- Full-recalculation oracle and incremental evaluator.
- Answer state, visibility aggregation, validation, navigation, and loop runtime.
- Renderer parity, answer serialization adapter, browser tests, and performance/memory baselines.
