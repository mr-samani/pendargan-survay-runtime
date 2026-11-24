# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 3 — immutable answer state, pure visibility projection, and explicit Select/UnSelect action transaction implemented; flow/navigation remains open

## Repository facts

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in app is an Angular 22 application under `projects/vote`.
- Dependencies include `ngx-exp-parser@1.0.2` and `ngx-kit@^9.5.2`.
- The lockfile resolves `ngx-exp-parser` to the exact npm tarball for version `1.0.2`; CI verifies the installed artifact exposes `ExpressionAnalyzer`.
- `FormQuestionTypesEnum` defines question type IDs 1–45 with gaps. The current renderer registry has loaders for only `HtmlFrame`, `UniqueSelect`, and `MultiSelect`.
- The API response includes sections, questions, question options, expressions, global variables, poll/form metadata, statuses, demography, system data, and temporary-voter data.
- The checked-in client does not initialize global variables or implement save/submit flow. See `docs/analysis/OBSERVED-LEGACY-BEHAVIOR.md`.

## Work completed on this branch

- Added project-specific architecture, legacy-analysis, compatibility, roadmap, task, testing, benchmark, and AI handoff documentation.
- Added typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Added CI workflow and repaired spec path aliases/stale starter tests.
- Added immutable definition types and `compileSurveyDefinition()` with detached, frozen snapshots of source DTOs.
- Added expression compilation through `FormulaEngineService.registerFormula()`, capturing dependencies and volatility without evaluating formulas or executing actions.
- Added a typed dependency graph with question/option/global-variable/formula/action/scope/external nodes, stable topological ordering, and iterative SCC cycle detection.
- Added a full-recalculation reference evaluator and dirty-node incremental evaluator. Propagation stops when global-variable values/availability do not change.
- Added seeded differential coverage: 100 input changes compare incremental results against the full evaluator after every update.
- Added immutable answer state with atomic input batches, JSON-safe snapshots, dirty tracking, and per-runtime-instance namespaces. This does not yet implement loop traversal.
- Added pure visibility projection for InsideForm Question/Answer Show/Hide. It calculates option, question, and section visibility and preserves unknown results for failed formulas.
- Added explicit Select/UnSelect action resolution and atomic answer-state application. Conflicts reject by default; callers may explicitly opt into select-wins or unselect-wins. This is a safe new policy surface, not a claim about legacy precedence.
- Unsupported action scopes/targets/types remain available as unhandled proposals for later handlers.

## CI validation

<badge color="success">Latest CI passed</badge>

- Run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45387317311
- `npm ci`: passed.
- Production build: passed.
- Unit tests: 13 files, 50 tests passed.
- Includes real FormulaEngineService integration, full/incremental parity across 100 seeded updates, answer-state atomicity, visibility aggregation/unknown conditions, and action conflict handling.

## Initial bundle snapshot

Measured by Angular 22 production build on GitHub Actions, Node 24.22.3:

| Chunk | Raw size | Estimated transfer |
|---|---:|---:|
| Initial total | 769.24 kB | 197.38 kB |
| MultiSelect | 6.72 kB | 1.96 kB |
| UniqueSelect | 6.26 kB | 1.94 kB |
| HtmlFrame | 418 B | 418 B |

The initial bundle exceeds the configured 500 kB warning budget by 269.24 kB. Angular also warns that `sanitize-html` is CommonJS. This is a measured baseline, not a final performance claim.

## Expression library

- `ngx-exp-parser` PR #2 (bytecode engine and dependency analysis) is merged into `main`.
- Merged PR: https://github.com/mr-samani/ExpParser/pull/2
- Merge commit: `597168c038d99fda3f81676a09c6cb7c6767855f`
- The checked-in package and lockfile both use version `1.0.2`; CI imports `ExpressionAnalyzer` from the installed npm artifact.

## Remaining work

- Verify all question types against production renderer availability and behavior.
- Verify global-variable reference naming and all expression target/action semantics.
- Required/validity, submit/end-form, quota, dynamic-answer, section-loop and post-submit action handlers.
- Hidden-answer retention/clearing policy.
- Normal navigation, one-question-per-page mode, repeated-section traversal, renderer parity, answer serialization/submission, browser tests, and runtime/memory benchmarks.
