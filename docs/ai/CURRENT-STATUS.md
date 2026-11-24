# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 0 — repository discovery; renderer-loading improvement implemented, validation in progress

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
- The generated enum lists many types. A renderer implementation for a type must not be assumed merely because the enum member exists.

## Work completed on this branch

- Added project-specific architecture, legacy-analysis, compatibility, roadmap, task, testing, benchmark, and AI handoff documentation.
- Added a typed question-renderer registry with in-flight/resolved Promise caching and retry after failed imports.
- Updated VoteService to load each distinct required renderer once and load different types concurrently.
- Added tests for renderer caching, unique-type loading, unsupported types, and retry after failure.
- Added a GitHub Actions workflow for production build and unit tests.
- Fixed the test TypeScript path aliases and two stale generated test specs (resolver export name and removed Angular `async` testing helper).

## CI observations

- Initial CI run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45377805777
- `npm ci` passed and the production build passed.
- Production build reported an initial bundle of 769.24 kB raw (197.38 kB estimated transfer), exceeding the 500 kB warning budget by 269.24 kB.
- It emitted lazy chunks for MultiSelect (6.72 kB), UniqueSelect (6.26 kB), and HtmlFrame (418 B).
- The first test run failed because the existing spec tsconfig omitted the application's path aliases and two existing specs referenced outdated Angular/export APIs. Follow-up commits fixed those issues; a rerun on the latest commit is still required.
- Build also warns that `sanitize-html` is CommonJS and may cause optimization bailouts.

## Expression library

- `ngx-exp-parser` PR #2 (bytecode engine and dependency analysis) is merged into `main` as of 2026-11-24.
- Merged PR: https://github.com/mr-samani/ExpParser/pull/2
- Merge commit: `597168c038d99fda3f81676a09c6cb7c6767855f`
- The app currently declares `ngx-exp-parser: ^1.0.2`. Verify the published npm artifact includes the merged implementation before relying on new public APIs. A Git merge alone does not prove an npm release contains it.

## Not yet done

- No complete legacy behavior inventory or production fixture suite exists.
- No performance baseline exists.
- No immutable definition compiler, dependency graph, incremental evaluator, answer-state engine, visibility engine, or flow runtime has been implemented.
- No tests currently prove parity with the production legacy implementation.
- No code has been merged to `master`; the current work is a draft PR.

## Important repository setting

GitHub currently reports this repository visibility as **public**. Confirm this is intentional before adding non-public production source, credentials, respondent data, or proprietary configuration. Do not put sensitive production data in fixtures.
