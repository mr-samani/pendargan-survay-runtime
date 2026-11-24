# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 3 — immutable answer state and pure option/question/section visibility projection implemented; action transaction and flow remain open

## Repository facts

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in app is an Angular 22 application under `projects/vote`.
- Dependencies include `ngx-exp-parser@1.0.2` and `ngx-kit@^9.5.2`.
- The lockfile resolves `ngx-exp-parser` to the exact npm tarball for version `1.0.2`; CI verifies the installed artifact exposes `ExpressionAnalyzer`.
- `FormQuestionTypesEnum` defines question type IDs 1–45 with gaps. The current renderer registry has loaders for only `HtmlFrame`, `UniqueSelect`, and `MultiSelect`.
- The API response includes sections, questions, question options, expressions, global variables, poll/form metadata, statuses, demography, system data, and temporary-voter data.
- The current checked-in client code does not initialize global variables or implement the save/submit flow. See `docs/analysis/OBSERVED-LEGACY-BEHAVIOR.md`.

## Work completed on this branch

- Added project-specific architecture, legacy-analysis, compatibility, roadmap, task, testing, benchmark, and AI handoff documentation.
- Added typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Added CI workflow and repaired spec path aliases/stale starter tests.
- Added immutable definition types for sections, questions, options, expressions, and global variables.
- Added `compileSurveyDefinition()` to create a detached, frozen definition snapshot from the API response.
- Every compiled section/question/option/expression/global variable includes a detached immutable `source` snapshot, preserving API fields not yet modeled explicitly.
- Added expression compilation through the installed `FormulaEngineService.registerFormula()` API. It captures dependencies/volatility and diagnostics without evaluating formulas or executing actions.
- Added a typed dependency graph with question/option/global-variable/formula/action/scope/external nodes, dependency edges, stable topological ordering, and iterative strongly-connected-component cycle detection.
- Added a full-recalculation reference evaluator and a stateful incremental evaluator. The incremental evaluator recomputes only reachable formulas and stops propagation when a global-variable value/availability is unchanged.
- Added seeded differential coverage: 100 input changes compare incremental results against the full evaluator after every update.
- Added an immutable answer-state store partitioned by runtime instance ID, atomic input command batches, stable option ordering, JSON-safe value cloning, no-op detection, and separate instance namespaces for repeated sections. This is state structure only; it does not implement loop traversal.
- Added a pure visibility projection for supported InsideForm Question/Answer Show/Hide actions. It calculates option, question, and section visibility, preserves unknown results for failed formulas, and returns unsupported proposals for later handlers.
- Added source-based legacy behavior documentation and CI tests.

## CI validation

<badge color="success">Latest CI passed</badge>

- Run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45386921456
- `npm ci`: passed.
- Production build: passed.
- Unit tests: 12 files, 44 tests passed.
- Includes real FormulaEngineService integration, full/incremental parity across 100 seeded updates, unchanged-value propagation stopping, atomic answer batches, loop-instance answer isolation, and visibility aggregation/unknown-condition tests.

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

- Full production behavior inventory and anonymized fixtures, especially save/submit and loop behavior.
- Verify every enum question type against actual production renderer/source availability.
- Verify global-variable reference naming and all expression target/action semantics against production fixtures.
- Action command model and conflict resolution; required/validity/submit actions; hidden-answer policy.
- Flow/navigation, repeated section traversal, renderer parity, answer serialization adapter, browser tests, and performance/memory baselines.
