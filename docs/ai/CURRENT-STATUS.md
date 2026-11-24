# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 3 — immutable answer state, visibility, actions, baseline validation, flow projection, and loop iteration state implemented; submission integration remains open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The owner confirms the original production client was supplied separately as a ZIP and was intentionally not added to this repository so the runtime can be rewritten cleanly.
- The archive has now been inspected for section-loop behavior. It remains a behavior reference; do not copy legacy architecture or generated code wholesale into the new runtime.
- The checked-in rewrite snapshot contains three renderer implementations: `HtmlFrame`, `UniqueSelect`, and `MultiSelect`. Its current `VoteService` does not initialize global variables or contain save/submit calls. Those are observations about this rewrite repository snapshot, not claims that the original application lacks the behavior.

## Stack and dependencies

- Angular 22 under `projects/vote`.
- Dependencies include `ngx-exp-parser@1.0.2` and `ngx-kit@^9.5.2`.
- The lockfile resolves `ngx-exp-parser` to the exact npm tarball for version `1.0.2`; CI verifies the installed artifact exposes `ExpressionAnalyzer`.
- `FormQuestionTypesEnum` defines question type IDs 1–45 with gaps.

## Work completed on this branch

- Added project-specific architecture, legacy-analysis, compatibility, roadmap, task, testing, benchmark, and AI handoff documentation.
- Added typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Added CI workflow and repaired spec path aliases/stale starter tests.
- Added immutable definition types and `compileSurveyDefinition()` with detached, frozen snapshots of source DTOs.
- Added expression compilation through `FormulaEngineService.registerFormula()`, capturing dependencies and volatility without evaluating formulas or executing actions.
- Added a typed dependency graph with question/option/global-variable/formula/action/scope/external nodes, stable topological ordering, and iterative SCC cycle detection.
- Added a full-recalculation reference evaluator and dirty-node incremental evaluator. Propagation stops when global-variable values/availability do not change.
- Added seeded differential coverage: 100 input changes compare incremental results against the full evaluator after every update.
- Added immutable answer state with atomic input batches, JSON-safe snapshots, dirty tracking, and per-runtime-instance namespaces.
- Added pure visibility projection for InsideForm Question/Answer Show/Hide.
- Added Select/UnSelect action resolution and atomic answer-state application.
- Added baseline answer validation for required answers, unknown option IDs, visibility states, and Point numeric bounds.
- Added section-per-page and question-per-page flow projections with stable previous/next navigation and section visibility gating.
- Added a loop runtime based on verified legacy semantics: active SectionLoop expression targeting section uniqueIdPerForm; zero-based UI iteration index; one-based backend auto-save index; root namespace for first pass; isolated per-section namespaces for subsequent passes; per-iteration variable snapshots; optional dynamic-data record ID; bounded iterations.
- Flow pages now expand over known loop iterations and expose answer instance + iteration context.
- Unsupported action scopes/targets/types remain available as unhandled proposals for later handlers.

## Verified legacy loop behavior

- The original client sets section.hasLoop from an active expression with targetType SectionLoop and matches targetKey to section.uniqueIdPerForm.
- Advancing a section repeats the same section while the current SectionLoop expression result is true; false advances to the next section.
- Legacy UI loopNumber starts at zero; auto-save sends loopIndexNumber = loopNumber + 1.
- Section snapshots are keyed by section ID and zero-based loop number and capture answers plus a variable dictionary.
- Full/temporary save emits ordered repeatSections containing voterAnswerDetails and variablesRepeatedSectionValue. Loading converts backend loopNumber to zero-based by subtracting one.
- RetailAudit is a separate legacy conversion path that synthesizes DynamicAnswer-like repeated pages from selected records.

## CI validation

The latest completed CI run before the current loop-runtime commit passed: 15 files, 62 tests, production build passed. The loop-runtime and expanded flow changes are awaiting CI.

## Initial bundle snapshot

Measured by Angular 22 production build on GitHub Actions, Node 24.22.3:

| Chunk | Raw size | Estimated transfer |
|---|---:|---:|
| Initial total | 769.24 kB | 197.38 kB |
| MultiSelect | 6.72 kB | 1.96 kB |
| UniqueSelect | 6.26 kB | 1.94 kB |
| HtmlFrame | 418 B | 418 B |

The initial bundle exceeds the configured 500 kB warning budget by 269.24 kB. Angular also warns that `sanitize-html` is CommonJS.

## Remaining work

- Exact SectionLoop formula/action result integration with runtime transitions and navigation.
- Loop-specific validation/visibility context and answer instance isolation parity tests.
- Exact save/submit adapter mapping completed/filled loop iterations to ordered backend repeatSections.
- Hidden-answer retention/clearing policy.
- RetailAudit conversion adapter.
- All question renderer parity, browser tests, and runtime/memory benchmarks.
