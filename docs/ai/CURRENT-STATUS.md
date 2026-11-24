# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 5 — runtime session and action reconciliation implemented; first legacy flat-token adapter and compatibility fixtures added; evaluator/global-variable parity remains open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The archived application is checked in under `PREVIUOS_SOURCE/` and is the behavior reference for the rewrite. It is not the implementation target and must not be copied wholesale.
- Legacy behavior must be verified against this source and golden API payloads; do not invent semantics where source behavior is unclear.

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
- Added tests for action recalculation to a fixed point, action feedback cycle detection, loop-aware backward navigation, and action-to-visibility reconciliation.
- Added an immutable, namespaced formula-scope projection indexed separately by question ID, uniqueIdPerForm, and source ID. It exposes selected-option metadata and only the active loop instance's variables.
- Inspected the archived `LogicService`, `ExpEvaluator`, formula helpers, question/answer models, expression DTOs, and enums. The verified flat formula-token contract and execution semantics are documented in `docs/architecture/LEGACY-FORMULA-COMPATIBILITY.md`.
- Added `createLegacyFormulaAnswerStates`: a pure projection from one immutable answer instance into legacy `Q{fid}.*` tokens, including choice aggregates, hidden state inputs, scalar values, matrix cells, SKU totals, dynamic placeholders, RecordsOtherForms, Captcha, Region, Demography, and System fields.
- Added legacy token splitting and global-variable/answer-token substitution helpers, preserving global-before-answer ordering and the `#` dependency/replacement mismatch. Answer-state string fragments are inserted without double quoting; global-variable string values are quoted separately as the old evaluator did.
- Added question-owned global-variable evaluation with source-order execution, inter-variable visibility through quoted `[%title%]` answer-state tokens, change tracking, and error-to-false handling.
- Added query-parameter global-variable precedence helper; its formula normalizer is injected so the old `cleanUpFormula` behavior is not guessed.
- Added a legacy question-variable index that reproduces title/description/initialValue/secondaryFilter/option-title scan order and the original `[%\\w+%]` token matcher.
- Added pure question-effect projection for global-variable updates: initial text/scalar values, Payment integer amount behavior, SkuCount_Dynamic/RetailAudit secondary-filter changes, unresolved leading-token behavior, reset behavior, and the legacy changeAnswer trigger conditions.
- Connected the question-variable index to a survey-level effect projector that preserves definition order and returns only affected question effects; it does not mutate definitions or dispatch UI events.
- Added an isolated legacy formula function library for keyed random caching, strict string predicates, avgWeakData weighting/rounding, loose equality helpers, and mathjs operator normalization. Tests confirmed that passing function values through the installed parser's `createReactiveModel` scope does not evaluate successfully, so the attempted wrapper was removed; parser function registration remains an explicit integration gap.
- Added 9 compatibility tests covering choice visibility and weighting, scalar defaults, matrix values, SKU, dynamic placeholders, RecordsOtherForms, region/environment fields, substitution order, missing values, and the `#` edge.

## Runtime boundaries

- The structured formula scope remains canonical. The new flat-token adapter is an explicit compatibility boundary and is not yet wired as the production evaluator scope. Its current matrix value shape is object-keyed by canonical option ID/fid/source ID and still needs confirmation against real payloads.
- The adapter uses explicit visibility and environment inputs because the old implementation read mutable `dontShow`, Region, Demography, and System values. It does not reproduce stale-token carry-over from the old mutable dictionary.
- Global-variable ownership/order and query-parameter precedence have isolated tested helpers, but they are not yet integrated into the full session question walk. Initial-value/secondary-filter side effects, question-walk scheduling, and evaluator parity remain pending.
- Legacy `ExpEvaluator` uses mathjs in its normal path and has a `new Function` branch when expressionCaseSensitive is false. The unsafe-eval branch is documented but must not be copied into the rewrite.
- Global-variable ownership is tied to `formQuestionUniqueId === question.uniqueId` in the old question walk. The new dependency graph must prove equivalent ownership/order before it replaces that behavior.
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

- [Legacy formula contract documentation CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45405951519) passed.
- Latest legacy formula, global-variable, question-effect, and function-library CI: [run](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45410623240) — passed (30 test files, 161 tests; production build passed).
- [Concrete projector and loop-aware navigation CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45403527306) passed.
- npm ci: passed.
- Angular production build: passed.
- Unit tests: 25 files, 120 tests passed on the latest code-test run.
- Initial bundle: 788.14 kB raw (202.03 kB estimated transfer); configured 500 kB warning budget is still exceeded.

## Next work

- Validate the adapter against real matrix answer payloads and dispatch projected initial-value commands/dynamic-filter refreshes through the session controller in an atomic, per-runtime-instance transaction. Extend ngx-exp-parser through a supported custom-function registration API before enabling the legacy function library.
- Implement and test legacy global-variable ownership, query-parameter precedence, string quoting, initial-value/secondary-filter side effects, and evaluation ordering without global mutable leakage.
- Verify custom function parity: random key caching, endsWith, startsWith, contains, and avgWeakData.
- Connect renderer inputs/outputs to immutable answer commands.
- Supply evaluated visibility and initial values to submission.
- Complete RetailAudit final-save conversion and temporary/full/partial payment save orchestration.
- Verify quotas, EndForm/SubmitForm, post-submit actions, and dynamic-answer filters.
- Add browser parity tests and runtime/memory benchmarks.
