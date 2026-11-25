# Current status

**Updated:** 2026-11-25  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 5 — runtime session, action reconciliation, legacy initial-value hydration, global-variable effect planning, question-walk compatibility plan, and dynamic-filter text projection implemented; live renderer/session integration and full formula parity remain open

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
- Added tests for action recalculation to a fixed point, action feedback cycle detection, loop-aware backward navigation, action-to-visibility reconciliation, and the ordering guarantee that changed global-variable initial values are applied before formula actions.
- Added an immutable, namespaced formula-scope projection indexed separately by question ID, uniqueIdPerForm, and source ID. It exposes selected-option metadata and only the active loop instance's variables.
- Inspected the archived `LogicService`, `ExpEvaluator`, formula helpers, question/answer models, expression DTOs, and enums. The verified flat formula-token contract and execution semantics are documented in `docs/architecture/LEGACY-FORMULA-COMPATIBILITY.md`.
- Added `createLegacyFormulaAnswerStates`: a pure projection from one immutable answer instance into legacy `Q{fid}.*` tokens, including choice aggregates, hidden state inputs, scalar values, matrix cells, SKU totals, dynamic placeholders, RecordsOtherForms, Captcha, Region, Demography, and System fields.
- Added legacy token splitting and global-variable/answer-token substitution helpers, preserving global-before-answer ordering and the `#` dependency/replacement mismatch. Answer-state string fragments are inserted without double quoting; global-variable string values are quoted separately as the old evaluator did.
- Added question-owned global-variable evaluation with source-order execution, inter-variable visibility through quoted `[%title%]` answer-state tokens, change tracking, and error-to-false handling.
- Added query-parameter global-variable precedence helper; its formula normalizer is injected so the old `cleanUpFormula` behavior is not guessed.
- Added a legacy question-variable index that reproduces title/description/initialValue/secondaryFilter/option-title scan order and the original `[%\\w+%]` token matcher.
- Added pure question-effect projection for global-variable updates: initial text/scalar values, Payment integer amount behavior, SkuCount_Dynamic/RetailAudit secondary-filter changes, unresolved leading-token behavior, reset behavior, and the legacy changeAnswer trigger conditions.
- Connected the question-variable index to a survey-level effect projector that preserves definition order and returns only affected question effects; it does not mutate definitions or dispatch UI events.
- Added legacy initial-value hydration before the first session projection, preserving `hasInitialValue`, inactive-question, Group-question, and unresolved-leading-`[%...%]` behavior.
- Wired initial-value hydration into root session creation and newly created SectionLoop answer instances; loop iterations only initialize questions present in that iteration's answer namespace, so other sections are not accidentally hydrated into the loop.
- Added `buildLegacyGlobalVariableEffectBatch` and wired it into the concrete projector's fixed-point loop. Changed global-variable answer commands are applied atomically before formula action proposals; when answers change, the projector reevaluates before applying actions.
- Added per-answer-instance persistence for previous global-variable results and non-answer runtime overrides. New loop instances start with independent maps; revisiting an existing instance reuses its prior values and overrides.
- Payment amount overrides and secondary-filter values are retained in `legacyRuntimeStateByInstance` and exposed on the session projection. Secondary-filter comparisons use the active instance's persisted value, so a later variable change can correctly restore an earlier filter value. The dynamic-filter refresh request is exposed in the effect batch; actual dynamic-data reload/UI event wiring is still open.
- Added a `VoteService` UI bridge that persists Payment/filter overrides by answer-instance ID, activates the matching state when root/loop instances change, and syncs it to reactive `QuestionModel` signals. `QuestionBase` exposes computed effective Payment amount, dynamic expression filter, secondary filter, and effect revision. This avoids mutating DTO settings or canonical answer values.
- Added a framework-agnostic `SurveyRuntimeSessionCoordinator` that owns start/dispatch/next/previous/reset, derives the active answer-instance ID for UI commands (so stale renderers cannot target another loop iteration), and notifies the UI bridge only after an accepted session transition. Its tests cover successful lifecycle dispatch, no-op suppression, validation-blocked navigation, pre-start misuse, and failed replacement starts.
- Added a per-`VoteComponent` `QuestionRuntimeEventBus` so dynamically-created renderers can publish typed answer-change events without relying on unsupported `NgComponentOutlet` output binding or a global singleton.
- Added a pure renderer-event adapter that resolves `uniqueIdPerForm`/source IDs to canonical definition IDs and creates active-instance-scoped answer commands. Unknown, ambiguous, and duplicate option references are rejected instead of guessed.
- Fixed the renderer adapter's TypeScript literal widening (`set-selected-options` now retains its discriminant type), discovered from the first real CI build. The earlier failing build was caused by this compile error; the corrected head is running CI now.
- Enforced the archived strict-boolean action contract in the full evaluator: non-boolean expression results no longer become truthy actions. They produce a warning and a false action condition, with regression coverage.
- Updated `UniqueSelect` and `MultiSelect` to publish typed selection changes after preserving their existing legacy `vote.form` updates; `MultiSelect` now also respects the renderer disabled state before processing a change. The event bus and adapter are independently tested. The live VoteComponent subscription/Coordinator dispatch is intentionally still pending.
- Added `RendererRuntimeSessionBridge`, a lifecycle adapter that accepts the already-restored answer/loop snapshots, starts the canonical coordinator, and only then subscribes to the view-scoped renderer event bus. It resolves renderer references, dispatches canonical commands through the coordinator (which independently scopes the active answer instance), reports adapter/session diagnostics, forwards accepted snapshots to the UI callback, and detaches/releases state on destroy. Tests cover subscribe-after-restore ordering, canonical ID mapping, invalid-reference rejection, and disposal.
- Reconstructed the archived `runFormula` question walk as a typed `LegacyQuestionExecutionPlan`: question order, question-owned global variables in source order, question-scoped formulas, repeated Section/SectionLoop formulas, and separate dynamic-filter formula ownership. The plan is exposed by the concrete runtime projector; topological scheduling still needs to enforce the legacy order without violating dependency edges.
- `FilterDynamicAnswer` is now compiled as a text template rather than registered as a boolean formula. Its explicit answer/global-variable references are retained as dependencies; the full evaluator returns typed filter templates without evaluating them or proposing boolean actions.
- Added a pure dynamic-filter resolver that substitutes canonical answer-state fragments and evaluated global-variable values, resolves the target by exact `uniqueIdPerForm`, reports unresolved/ambiguous targets, and returns `dynamicFilterUpdates` from the concrete projector.
- Extended the session projection contract with dynamic-filter updates and synchronized them through `VoteService.synchronizeRuntimeSession`. The UI bridge replaces the complete filter set per answer instance, clears stale filters, preserves Payment/secondary-filter effects, and updates a reactive `QuestionModel.runtimeFieldValueFilter` signal only when its effective value changes. `QuestionBase.effectiveFieldValueFilter` now observes this runtime override.
- Added an isolated legacy formula function library for keyed random caching, strict string predicates, avgWeakData weighting/rounding, loose equality helpers, and mathjs operator normalization. Tests confirmed that passing function values through the installed parser's `createReactiveModel` scope does not evaluate successfully, so the attempted wrapper was removed; parser function registration remains an explicit integration gap.
- Added 9 compatibility tests covering choice visibility and weighting, scalar defaults, matrix values, SKU, dynamic placeholders, RecordsOtherForms, region/environment fields, substitution order, missing values, and the `#` edge.

## Runtime boundaries

- The structured formula scope remains canonical. The new flat-token adapter is an explicit compatibility boundary and is not yet wired as the production evaluator scope. Its current matrix value shape is object-keyed by canonical option ID/fid/source ID and still needs confirmation against real payloads.
- The adapter uses explicit visibility and environment inputs because the old implementation read mutable `dontShow`, Region, Demography, and System values. It does not reproduce stale-token carry-over from the old mutable dictionary.
- Global-variable ownership/order and query-parameter precedence have isolated tested helpers, but the new typed question-walk plan is currently descriptive/projected and is not yet the scheduler that drives formula evaluation. Initial-value answer effects are dispatched by the projector; Payment/filter effects are persisted and exposed through the session and UI bridge. Dependency-aware question-walk scheduling, live session-to-UI invocation, cancellable dynamic-data reload/selected-answer restoration, and evaluator parity remain pending.
- Legacy `ExpEvaluator` uses mathjs in its normal path and has a `new Function` branch when expressionCaseSensitive is false. The unsafe-eval branch is documented but must not be copied into the rewrite.
- Global-variable ownership is tied to `formQuestionUniqueId === question.uniqueId` in the old question walk. The new dependency graph must prove equivalent ownership/order before it replaces that behavior.
- The built-in action transaction currently applies InsideForm Answer Select/UnSelect only.
- Visibility currently resolves InsideForm Question/Answer Show/Hide only.
- Validation currently covers required values, unknown selected options, and Point range only.
- Unsupported actions are reported as warnings and are not silently applied.
- Added a UI effect bridge in `VoteService`: it stores Payment amount and secondary-filter overrides by answer-instance ID, activates the correct values when a root/loop instance is selected, and syncs them to reactive `QuestionModel` signals. `QuestionBase` exposes computed Payment amount, dynamic expression filter, secondary filter, and an effect revision for lazy renderers to observe.
- API DTO settings and canonical answer values are not mutated by these UI overrides. Tests cover per-instance isolation, fallback to original settings, unchanged-value suppression, batched revision updates, and preservation of unrelated overrides.
- `VoteService.synchronizeRuntimeSession(session)` now provides the adapter boundary: it reads the current page's answer-instance ID, applies the projection's Payment/filter effects, and activates that instance in the UI model. The live `VoteComponent`/session lifecycle still does not invoke it; canonical answer hydration, Payment/DynamicAnswer/SkuCount_Dynamic renderers, and the dynamic-data API loader remain open. Full renderer wiring, browser parity, and complete API save orchestration remain open.

## Known generated DTO differences

- Legacy dynamicDataRecordId supports string or number; the generated DTO currently supports number only. Non-numeric identifiers are rejected explicitly.
- Legacy file detail includes fileId, fileUniqueId, and order; the generated DTO currently exposes only fileUniqueId and order.
- RetailAudit final submission transformation remains separate from the completed restore path.
- VoiceRecord restore still requires a dedicated mapping.

## CI validation

- [Legacy formula contract documentation CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45405951519) passed.
- Latest runtime-to-UI effect bridge CI: [run](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45551100800) — passed (34 test files, 186 tests; production build passed).
- [Concrete projector and loop-aware navigation CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45403527306) passed.
- npm ci: passed.
- Angular production build: passed.
- Unit tests: 34 files, 186 tests passed on the latest code-test run.
- Initial bundle: 788.14 kB raw (202.03 kB estimated transfer); configured 500 kB warning budget is still exceeded.

## Next work

- Build the explicit runtime-session lifecycle owner and integrate it with `VoteComponent` only after answer hydration/command wiring is complete; call `VoteService.synchronizeRuntimeSession(session)` after accepted transitions. Then implement Payment/DynamicAnswer/SkuCount_Dynamic renderers that consume the reactive `QuestionBase` signals and connect secondary-filter revisions to cancellable dynamic-data requests. Validate the adapter against real matrix answer payloads and add repeated-loop UI integration tests.
- Implement and test legacy global-variable ownership, query-parameter precedence, string quoting, initial-value/secondary-filter side effects, and evaluation ordering without global mutable leakage.
- Verify custom function parity: random key caching, endsWith, startsWith, contains, and avgWeakData.
- Connect renderer inputs/outputs to immutable answer commands.
- Supply evaluated visibility and initial values to submission.
- Complete RetailAudit final-save conversion and temporary/full/partial payment save orchestration.
- Verify quotas, EndForm/SubmitForm, post-submit actions, and dynamic-answer filters.
- Add browser parity tests and runtime/memory benchmarks.


## Latest compatibility correction — Matrix cell answers

- Verified the archived `LogicService.generateAnswerStates` behavior: `Matrix_MultiNumeric` and `Matrix_MultiShortText` read each cell from the option model's `answerDescription`, not from a selected-option flag alone.
- Updated backend restore to rebuild a canonical per-option cell-value map and select only non-empty cells.
- Updated submission serialization to write each selected cell's value back to `answerDescription`; non-scalar cell values fail with a typed serialization error.
- Added restore, serialization, and restore-to-formula-projection regression tests, including empty-cell behavior.
- CI on the implementation commit passed production build and 205 tests across 38 test files. The follow-up end-to-end formula projection test is included in the next CI run.


## Latest formula compatibility correction — quoted global-variable tokens

- Verified that archived `replaceGvarValues` avoids replacing global-variable markers inside quoted string literals.
- Replaced unconditional marker substitution with a quote-aware scanner that handles both quote styles, escaped quote characters, case-insensitive global-variable titles, and surrounding whitespace without modifying quoted content.
- Added regression coverage for quoted markers, escaped quotes, case-insensitive matching, and whitespace/operator preservation.
- Latest push and pull-request CI both passed on the current implementation head: production build succeeded and all 209 tests across 38 test files passed.


## Global-variable title compatibility

- Legacy formula tokens use global-variable display titles (for example `[%Customer Name%]`), which are not guaranteed to equal the API ID or `uniqueIdPerForm`.
- Dependency resolution now indexes the display title case-insensitively in addition to stable API identifiers.
- The formula evaluator exposes the same title aliases while evaluating dependent formulas and restores pre-existing engine variables after evaluation.
- Regression coverage verifies dependency edges and evaluation order when the display title differs from both API identifiers.
- Latest verified code CI before the question-walk/filter work passed: production build succeeded and all 211 tests across 38 test files passed. The legacy execution-plan and dynamic-filter pipeline CI passed on runtime implementation commit `0d67bd6`: production build succeeded and all 223 tests across 40 test files passed. The per-instance UI filter synchronization CI passed: production build succeeded and all 228 tests across 40 test files passed. The following documentation-only commit does not change runtime code.
