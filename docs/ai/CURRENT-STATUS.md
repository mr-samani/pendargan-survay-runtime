# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 1 — immutable definition and expression compilation layers implemented; latest CI validation pending

## Repository facts

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in app is an Angular 22 application under `projects/vote`.
- Dependencies include `ngx-exp-parser@1.0.2` and `ngx-kit@^9.5.2`.
- The lockfile resolves `ngx-exp-parser` to the exact npm tarball for version `1.0.2`.
- A CI compatibility test imports `ExpressionAnalyzer` from the installed npm package; it passed. This verifies that the published artifact used by CI exposes the analyzer API merged in ExpParser.
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
- The definition compiler preserves inactive definitions and expression metadata; it does not infer answer, visibility, navigation, or loop-instance semantics.
- Added expression compilation through the installed `FormulaEngineService.registerFormula()` API.
- Expression compilation namespaces formula IDs by survey and source kind, captures dependency/volatility metadata, and reports parse diagnostics.
- The expression compiler registers source but never evaluates it or executes its associated action.
- Added tests for expression metadata, dependency capture, active/inactive parse failures, empty inactive source, and invalid definition handling.

## CI validation

- Previous successful run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45380245719
- `npm ci`: passed.
- Production build: passed.
- Unit tests: 6 files, 13 tests passed, including the installed `ExpressionAnalyzer` public API compatibility check.
- The expression compiler commit is still awaiting its own CI result.

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

- `ngx-exp-parser` PR #2 (bytecode engine and dependency analysis) is merged into `main`.
- Merged PR: https://github.com/mr-samani/ExpParser/pull/2
- Merge commit: `597168c038d99fda3f81676a09c6cb7c6767855f`
- The checked-in package and lockfile both use version `1.0.2`; CI successfully imports `ExpressionAnalyzer` from the installed npm artifact.

## Remaining work

- Full production behavior inventory and anonymized fixtures.
- Verify every enum question type against actual production renderer/source availability.
- Trace expression action semantics, quotas, global variables, save/submit, and temporary-save flows.
- Typed dependency graph and cycle diagnostics.
- Full-recalculation oracle and incremental evaluator.
- Answer state, visibility aggregation, validation, navigation, and loop runtime.
- Renderer parity, answer serialization adapter, browser tests, and performance/memory baselines.
