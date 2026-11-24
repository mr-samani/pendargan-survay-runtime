# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 0 — repository discovery; first lazy-renderer milestone implemented and CI-green

## Repository facts

- The repository currently has one branch, `master`; the GitHub default branch is `master`. There is no `main` branch to merge into.
- The checked-in app is an Angular 22 application under `projects/vote`.
- Dependencies include `ngx-exp-parser@^1.0.2` and `ngx-kit@^9.5.2`.
- `FormQuestionTypesEnum` contains many question type IDs. The current renderer registry has dynamic imports for only `HtmlFrame`, `UniqueSelect`, and `MultiSelect`.
- The current `QuestionModel` extends the generated API DTO and combines data normalization, rendering component reference, expression buckets, and UI state.
- `VoteService` currently owns the expression engine, reactive form model, question collection, pagination flags, state-key mapping, loading, and expression registration.
- `QuestionModel.canShow` is a computed signal that calls `checkOptionExpr()`; that method iterates options and writes `opt.canShow`. This is a side effect inside a derived computation and must be removed in the new design.
- `checkOptionExpr()` evaluates Show/Hide/Select/UnSelect expressions, but the current code only assigns the Show/Hide result to `opt.canShow`; the Select/UnSelect results are computed and not applied in the inspected implementation.
- The current view renders visible questions using `NgComponentOutlet` and a per-question component reference.

## Work completed on this branch

- Added project-specific architecture, legacy-analysis, compatibility, roadmap, task, testing, benchmark, and AI handoff documentation.
- Added a typed question-renderer registry with in-flight/resolved Promise caching and retry after failed imports.
- Updated VoteService to load each distinct required renderer once and load different types concurrently.
- Added tests for renderer caching, unique-type loading, unsupported types, and retry after failure.
- Added a GitHub Actions workflow for production build and unit tests.
- Fixed the existing spec tsconfig path aliases and stale generated specs.

## CI validation

<badge color="success">CI passed</badge>

- Successful run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45378383355
- `npm ci`: passed.
- Production build: passed.
- Unit tests: 4 test files, 8 tests passed.
- The first test run exposed existing test configuration and stale test expectations; those were corrected before the successful run.

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
- The app currently declares `ngx-exp-parser: ^1.0.2`. Verify the published npm artifact includes the merged implementation before relying on new public APIs. A Git merge alone does not prove an npm release contains it.

## Not yet done

- No complete legacy behavior inventory or production fixture suite exists.
- No runtime interaction benchmark or memory baseline exists.
- No immutable definition compiler, dependency graph, incremental evaluator, answer-state engine, visibility engine, or flow runtime has been implemented.
- No tests prove parity with the production legacy implementation.
- No code has been merged to `master`; the current work is a draft PR.

## Important repository setting

GitHub currently reports this repository visibility as **public**. Confirm this is intentional before adding non-public production source, credentials, respondent data, or proprietary configuration. Do not put sensitive production data in fixtures.
