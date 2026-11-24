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
- Previous navigation reactivates the target loop iteration and reprojects validation/visibility for that iteration instead of leaving the loop cursor on a different answer instance.
- Concrete runtime projector that runs formula evaluation, applies supported Select/UnSelect proposals atomically, re-evaluates until stable, and produces visibility, validation, and flow projections.
- Projector returns the reconciled answer snapshot; the session commits that snapshot together with its derived projections, preventing action-updated answers from being lost.
- Bounded action passes, answer-state cycle detection, evaluator exception handling, stale validation rejection, and explicit unsupported-action warnings.
- Added tests for action recalculation to a fixed point, action feedback cycle detection, and loop-aware backward navigation.
- Added an immutable, namespaced formula-scope projection indexed separately by question ID, uniqueIdPerForm, and source ID. It exposes selected-option metadata and only the active loop instance's variables.

## Runtime boundaries

- Formula scope creation is available as an explicit new contract, but legacy expression aliases and parser access semantics are **not yet verified**. Do not make it the production default until compared with the original logic service and real formulas.
- Global-variable aliases are still managed by the formula evaluator; the new scope factory does not merge loop variables into global engine state.
- The built-in action transaction currently applies InsideForm Answer Select/UnSelect only.
- Visibility currently resolves InsideForm Question/Answer Show/Hide only.
- Validation currently covers required values, unknown selected options, and Point range only.
- Unsupported actions are reported as warnings and are not silently applied.
- Full renderer wiring, browser parity, and complete API save orchestration remain open.

## Known generated DTO differences

- Legacy dynamicDataRecordId supports string or number; the generated DTO currently supports number only. Non-numeric identifiers are rejected explicitly.
- Legacy file detail includes fileId, fileUniqueId, and order; the generated DTO currently exposes only fileUniqueId and order.
- RetailAudit final submission transformation remains separate from the completed restore path.
- VoiceRecord restore still requires a dedicated mapping.

## CI validation

- [Concrete projector and loop-aware navigation CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45403281752) passed after the formula-scope addition.
- npm ci: passed.
- Angular production build: passed.
- Unit tests: 24 files, 115 tests passed after the formula-scope addition.
- Initial bundle: 788.14 kB raw (202.03 kB estimated transfer); configured 500 kB warning budget is still exceeded.

## Next work

- Verify legacy formula aliases, parser scope behavior, missing-value semantics, and global-variable precedence against the original logic service.
- Add golden tests for formula/action/visibility interactions and action precedence.
- Connect renderer inputs/outputs to immutable answer commands.
- Supply evaluated visibility and initial values to submission.
- Complete RetailAudit final-save conversion and temporary/full/partial payment save orchestration.
- Verify quotas, EndForm/SubmitForm, post-submit actions, and dynamic-answer filters.
- Add browser parity tests and runtime/memory benchmarks.
