# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 4 — runtime session, action reconciliation, and derived projection pipeline implemented; renderer and API parity remain open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The original production client ZIP is retained as a behavior reference and intentionally excluded from the rewrite repository.
- Legacy behavior must be verified against the original source and golden API payloads; do not copy the old application wholesale.

## Work completed on this branch

- Typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- CI workflow, repaired test aliases, and replaced stale starter specs.
- Immutable definition compilation and expression metadata compilation.
- Typed dependency graph, stable topological ordering, iterative SCC cycle detection, full-recalculation oracle, and dirty-node incremental evaluator.
- Seeded differential coverage: 100 input changes compare incremental results with the full evaluator.
- Immutable answer state with atomic commands, JSON-safe snapshots, dirty tracking, and per-runtime-instance namespaces.
- Pure visibility projection for the supported InsideForm Question/Answer Show/Hide subset.
- Select/UnSelect action resolution and atomic application with explicit conflict policies.
- Baseline validation for required answers, unknown option IDs, visibility states, and Point numeric bounds.
- Section-per-page and question-per-page flow projections.
- SectionLoop runtime based on active InsideForm SectionLoop expressions, including isolated answer namespaces, variable snapshots, backward re-entry, future iteration reuse, filled tracking, and loop-aware flow pages.
- Loop submission envelope with ordered repeatSections and merged variablesLastValue.
- Per-question answer serializer based on verified legacy ConverterDataService mappings.
- Top-level CreateVoterWithDetailsDto metadata builder, including GPS omission semantics, poll route, allocation, temporary-save/accept-previous flags, partial-payment metadata, and voice-record metadata.
- Saved-answer restore for supported types and repeated sections, including one-based backend loop numbers, isolated answer instances, popup filled state, elapsed time, and RetailAudit child reconstruction.
- Runtime session controller with atomic answer dispatch, validation-gated navigation, previous/next navigation, and SectionLoop transitions.
- Concrete runtime projector that runs formula evaluation, applies supported Select/UnSelect proposals atomically, re-evaluates until stable, and produces visibility, validation, and flow projections.
- Formula-engine adapter helper binds `evaluateSurveyFully` to an application-owned formula scope factory.
- Projector returns the reconciled answer snapshot; the session commits that snapshot together with its derived projections, preventing action-updated answers from being lost.
- Bounded action passes, answer-state cycle detection, evaluator exception handling, stale validation rejection, and explicit unsupported-action warnings.
- Added tests for action recalculation to a fixed point and action feedback cycle detection.

## Runtime boundaries

- Formula scope creation remains application-owned. The projector receives a scope factory because answer aliases, system variables, and formula semantics must match the real client and must not be guessed.
- The built-in action transaction currently applies InsideForm Answer Select/UnSelect only.
- Visibility currently resolves InsideForm Question/Answer Show/Hide only.
- Validation currently covers required values, unknown selected options, visibility, and Point range only.
- Unsupported actions are reported as warnings and are not silently applied.
- Full renderer wiring, browser parity, and complete API save orchestration remain open.

## Known generated DTO differences

- Legacy dynamicDataRecordId supports string or number; the generated DTO currently supports number only. Non-numeric identifiers are rejected explicitly.
- Legacy file detail includes fileId, fileUniqueId, and order; the generated DTO currently exposes only fileUniqueId and order.
- RetailAudit final submission transformation remains separate from the completed restore path.
- VoiceRecord restore still requires a dedicated mapping.

## CI validation

- [Runtime session controller CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45400294630) passed before the concrete projector addition.
- A new CI run is triggered by the concrete projector and its tests; its result must be checked before declaring this milestone green.

## Initial bundle snapshot

| Chunk | Raw size | Estimated transfer |
|---|---:|---:|
| Initial total | 769.23 kB | 197.32 kB |
| MultiSelect | 6.72 kB | 1.95 kB |
| UniqueSelect | 6.26 kB | 1.93 kB |
| HtmlFrame | 418 B | 418 B |

The initial bundle exceeds the configured 500 kB warning budget by 269.23 kB. Angular also warns that `sanitize-html` is CommonJS.

## Next work

- Build and verify the formula scope factory against legacy expression inputs, variable aliases, question/option values, and loop-local variables.
- Add golden tests for formula/action/visibility interactions and action precedence.
- Connect renderer inputs/outputs to immutable answer commands.
- Supply evaluated visibility and initial values to submission.
- Complete RetailAudit final-save conversion and temporary/full/partial payment save orchestration.
- Verify quotas, EndForm/SubmitForm, post-submit actions, and dynamic-answer filters.
- Add browser parity tests and runtime/memory benchmarks.
