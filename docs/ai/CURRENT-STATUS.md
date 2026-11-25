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
- Fixed the renderer adapter's TypeScript literal widening (`set-selected-options` now retains its discriminant type), discovered from the first real CI build. The earlier failing build was caused by this compile error; the corrected head passed production build and unit tests on GitHub Actions.
- Enforced the archived strict-boolean action contract in the full evaluator: non-boolean expression results no longer become truthy actions. They produce a warning and a false action condition, with regression coverage.
- Updated `UniqueSelect` and `MultiSelect` to publish typed selection changes after preserving their existing legacy `vote.form` updates; `MultiSelect` now also respects the renderer disabled state before processing a change.
- Added a lazy shared `ScalarAnswer` renderer for ShortText, LongText, Numeric, Date, Time, Email, Phone, Mobile, NationalCode, and PostalCode. It emits canonical `question-value` events; numeric values are finite-number normalized and blank/invalid numeric input stays empty. Added normalization and event-bus regression tests. CustomMaskShortText and legacy-specific validators/masks remain intentionally out of scope for this first slice.
- Added `RendererRuntimeSessionBridge`, a lifecycle adapter that accepts the already-restored answer/loop snapshots, starts the canonical coordinator, and only then subscribes to the view-scoped renderer event bus. It resolves renderer references, dispatches canonical commands through the coordinator (which independently scopes the active answer instance), reports adapter/session diagnostics, forwards accepted snapshots to the UI callback, and detaches/releases state on destroy. Tests cover subscribe-after-restore ordering, canonical ID mapping, invalid-reference rejection, and disposal.
- Reconstructed the archived `runFormula` question walk as a typed `LegacyQuestionExecutionPlan`: question order, question-owned global variables in source order, question-scoped formulas, repeated Section/SectionLoop formulas, and separate dynamic-filter formula ownership. The plan is passed into the full evaluator and now drives each question step. Each step expands to a dependency-closed topological schedule, pulling future-owned prerequisites forward only when required; Section/SectionLoop expressions are reevaluated on every question step. Repeated formula results/actions are collapsed by stable ID with the latest value while preserving first-seen order.
- `FilterDynamicAnswer` is now compiled as a text template rather than registered as a boolean formula. Its explicit answer/global-variable references are retained as dependencies; the full evaluator returns typed filter templates without evaluating them or proposing boolean actions.
- Added a pure dynamic-filter resolver that substitutes canonical answer-state fragments, DynamicAnswer record placeholders, and evaluated global-variable values; resolves the target by exact `uniqueIdPerForm`; reports unresolved/ambiguous targets; and returns `dynamicFilterUpdates` from the concrete projector.
- Extended the session projection contract with dynamic-filter updates and synchronized them through `VoteService.synchronizeRuntimeSession`. The UI bridge replaces the complete filter set per answer instance, clears stale filters, preserves Payment/secondary-filter effects, and updates a reactive `QuestionModel.runtimeFieldValueFilter` signal only when its effective value changes. `QuestionBase.effectiveFieldValueFilter` now observes this runtime override.
- Added an isolated legacy formula function library for keyed random caching, strict string predicates, avgWeakData weighting/rounding, loose equality helpers, and mathjs operator normalization. Tests confirmed that passing function values through the installed parser's `createReactiveModel` scope does not evaluate successfully, so the attempted wrapper was removed; parser function registration remains an explicit integration gap.
- Added 9 compatibility tests covering choice visibility and weighting, scalar defaults, matrix values, SKU, dynamic placeholders, RecordsOtherForms, region/environment fields, substitution order, missing values, and the `#` edge.

## Runtime boundaries

- The structured formula scope remains canonical. The new flat-token adapter is an explicit compatibility boundary and is not yet wired as the production evaluator scope. Its current matrix value shape is object-keyed by canonical option ID/fid/source ID and still needs confirmation against real payloads.
- The adapter uses explicit visibility and environment inputs because the old implementation read mutable `dontShow`, Region, Demography, and System values. It does not reproduce stale-token carry-over from the old mutable dictionary.
- Global-variable ownership/order and query-parameter precedence have isolated tested helpers, and the dependency-aware question-walk schedule now drives full formula evaluation while preserving graph topological constraints. Initial-value answer effects are dispatched by the projector; Payment/filter effects are persisted and exposed through the session and UI bridge. Live dynamic-data requests/cancellation/selected-answer restoration and full evaluator parity remain pending.
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
- Latest verified code CI before the question-walk/filter work passed: production build succeeded and all 211 tests across 38 test files passed. The legacy execution-plan and dynamic-filter pipeline CI passed on runtime implementation commit `0d67bd6`: production build succeeded and all 223 tests across 40 test files passed. The per-instance UI filter synchronization CI passed: production build succeeded and all 228 tests across 40 test files passed. The dependency-aware question-walk scheduler CI passed: production build succeeded and all 230 tests across 40 test files passed. The latest CI on the current PR head passed: production build succeeded and all 231 tests across 40 test files passed.


## Dynamic-data request foundation

- Added `DynamicDataRequestRegistry<T>`, keyed by answer-instance ID and question ID. It cancels replaced requests through RxJS unsubscription (which aborts Angular HttpClient requests), guards against stale request IDs, rejects requests from inactive loop instances, cancels in-flight work on instance changes, and retains each instance's last successful result during refresh/failure.
- Added exact legacy autocomplete request builders: DynamicAnswer/SkuCount_Dynamic search uses `DynamicExpression` only when the effective filter is non-empty; SKU initial loading parses English/Persian comma-separated secondary-filter IDs into `recordIdArrayToGet`.
- Added pure selection reconciliation helpers: DynamicAnswer restores a prior choice by record identity only when the refreshed options still contain it; SkuCount_Dynamic merges fetched options without duplicates, preserves existing quantity/history, restores saved totals, and applies stable server-order sorting.
- These are tested runtime primitives. The loader now has a production Angular HttpClient transport and a per-instance/per-question `watch()` stream for renderer bindings; live DynamicAnswer/SkuCount_Dynamic renderers are still not part of the current registered renderer set.

Latest dynamic-data foundation CI on commit `5acfbdd` (including cached-result retention across loop-instance switches): production build passed; 43 test files and 244 tests passed.


## Dynamic-data HTTP and refresh orchestration

- Added DynamicDataHttpLoader using the archived getDynamicOptionAutoCompleteV2 endpoint contract. A root-provided Angular HttpClient transport now uses the existing API_BASE_URL token and configured HTTP interceptor chain; the runtime owns response normalization, per-instance request state, cancellation, and stale-response protection.
- Added DynamicDataRefreshCoordinator to connect resolved FilterDynamicAnswer updates and LegacyGlobalVariableQuestionEffects secondary-filter changes to the loader.
- Filter refreshes are deduplicated per (answerInstanceId, questionId). Unresolved legacy tokens cancel an in-flight request instead of sending an incomplete filter. Explicit user text search remains a separate operation.
- Autocomplete and SKU initial-list modes remain distinct: the latter sends parsed secondary-filter IDs as recordIdArrayToGet.
- Added `DynamicDataHttpLoader.watch(instanceId, questionId)`: it emits the current state immediately, then only state transitions for the requested question in the requested answer instance. This is the renderer-facing observable boundary and does not mix repeated SectionLoop instances.
- Matched archived SKU request parsing by removing embedded ASCII spaces from each record ID. Preserved `null` SKU totals during answer reconciliation instead of coercing them to zero.
- Latest CI on commit `fb601bb`: production build passed; 46 test files and 257 tests passed. Both push CI ([45575964030](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45575964030)) and PR CI ([45575972052](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45575972052)) passed.
- The authenticated HTTP/DI boundary and a tested renderer-facing controller are now connected. Production Angular renderer components, `QuestionBase` signal subscriptions, answer callback dispatch through `RendererRuntimeSessionBridge`, and `VoteComponent` bootstrap remain open.

## Latest renderer-controller integration — 2026-11-25

- Added `DynamicDataRendererController` as the renderer-facing adapter for one answer-instance/question pair. It owns DTO-derived registration, the replayed loader snapshot stream, initialization, explicit text search, computed-filter refresh, and SKU secondary-filter refresh.
- DynamicAnswer selection is restored by `identificationCode`, auto-selection is limited to the first initial list when no saved answer exists, and IDs reserved by earlier SectionLoop iterations cannot be selected.
- SKU request semantics now preserve the archived distinction: autocomplete responses are suggestion lists only; secondary-filter initial-list responses populate the selected SKU collection. The controller publishes immutable SKU operations and reconciled selected rows through a single answer callback.
- Stale controllers are prevented from searching or changing answers after the loader activates another answer instance.
- Added controller regression tests for initial request payloads, identity-based selection, loop duplicate protection, stale-controller rejection, separate SKU request modes, saved total/history restore, and immutable SKU operations.
- Architecture and handoff docs explicitly record that this controller is not yet an Angular renderer template or a live VoteComponent/session bridge hookup.
- Latest validated head: `839e347a50ab4c01f2b24a3ff90ad5a48c8e5bc6`. Production build passed; 48 test files and 279 tests passed. [Push CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45584247802) and [PR CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45584259483) both passed.

## Angular dynamic renderer integration — 2026-11-25

- Added standalone lazy-loaded Angular renderers for `FormQuestionTypesEnum.DynamicAnswer` and `FormQuestionTypesEnum.SkuCount_Dynamic`.
- DynamicAnswer binds to the per-question controller stream, supports search/select/clear, identity-based saved selection restore, reserved-loop duplicate disabling, auto-select-first, required-state projection, and legacy formula fields (`Data.*`, `TotalAnswers`, `selectableItemCount`).
- SkuCount_Dynamic binds to the same controller boundary, supports suggestion search/add/remove, advance-button quantity history, manual totals, aggregate total, and required-state projection. Initial secondary-filter loads are enabled only for `dontShowAllWithoutSearch`, matching the archived renderer's condition.
- Both components react to `QuestionModel.effectiveFieldValueFilter`; SKU additionally reacts to `effectiveSecondaryFieldValueFilter`. They recreate their controller when the active answer-instance ID changes and unsubscribe on destroy.
- SKU merge now refreshes fetched metadata for already-selected records while preserving quantity, current total, and history. Subsequent secondary-filter responses no longer overwrite edits with the original saved-answer snapshot.
- Renderer event bus supports JSON-safe `question-value` changes. The adapter maps them to canonical `set-value` commands, with bridge tests for DynamicAnswer and SKU payloads.
- `VoteComponent` now attempts canonical definition/graph/projector bootstrap after the legacy DTO initialization and starts the event bridge before rendering the loaded questions. Bootstrap failures are diagnosed and do not block the existing legacy question UI.
- Dynamic-data HTTP loader and refresh coordinator are scoped to the VoteComponent injector and dispose request state on injector teardown.
- This is a guarded integration milestone, not a claim of complete parity: formula scope alias compatibility and restoring saved-voter DTOs into the initial session remain open. When either prevents startup, the legacy view continues without canonical event dispatch.

- Latest integration commit: `5d80e9c9578cace183dad85d43223b2c295f0c40`. Production build passed; 48 test files and 282 tests passed. [Push CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45586739848) passed; [PR CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45586751042) was running at the time of this update.


## 2026-11-25 — legacy formula execution schedule connected

- The canonical formula evaluator now consumes the legacy question execution plan instead of silently ignoring it.
- Formula execution follows question order, evaluates each question's owned global variables before its question formulas, and revisits Section / SectionLoop formulas at every question step.
- Dependency-closed per-question schedules remain topologically ordered; repeated section formulas are deliberately retained because the archived runtime recalculated them during each question walk.
- FilterDynamicAnswer remains a text-template phase and is resolved after formula evaluation, not treated as a boolean action.


## 2026-11-25 — formula scheduling and loop restore hardening

- Connected the compiled legacy question execution plan to the production formula-evaluator adapter. The evaluator now consumes the plan's per-question topological schedules instead of falling back to one global graph order.
- Preserved source order and intentional repeated Section / SectionLoop formula evaluation across question steps. FilterDynamicAnswer stays in its dedicated text-template resolution phase.
- Saved SectionLoop pages now restore their own `voterVariables` into isolated loop-iteration variable snapshots. This prevents restored iterations from inheriting or losing another iteration's variable values.
- Validation on `cd2ab7ebcb85781788bfb71ca07eb6d7d7f14172`: production build passed; 48 test files and 284 tests passed. [Push CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45590551442) and [PR CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45590542244) passed.
- Saved `GetVoterFullDetail` answer restore is implemented and tested as a pure runtime adapter, but the VoteComponent edit/temp-resume loading path and legacy QuestionModel hydration are not yet wired. Do not enable canonical startup for edit/resume until that integration is complete.


## 2026-11-25 — canonical answer lifecycle and complete section serialization

- Added a tested canonical-to-legacy projection for active answer instances. Accepted runtime transitions now hydrate the active `QuestionModel`, option selection/description/order fields, and the legacy formula model (`@Q...`) from the canonical immutable answer snapshot.
- The projection covers scalar answers with descriptions, choice selections, option-specific descriptions, matrix cell values, HasPriority ordering/descriptions, DynamicAnswer and SKU payloads, file payloads, and other JSON-safe answer shapes without mutating canonical state.
- Connected the live Edit route query contract (`voterId` / `voterSequentialUniqueId` plus `pollUniqueId`) to `VotingService.getVoterFormQuestionAndAnswerDetail`. The returned `GetVoterFullDetail` is restored before canonical session startup.
- Connected temporary-save restore using the archived `GetVoterForEdit({ id: pollGuid })` contract. When `tempVoter` metadata exists, the participant must explicitly accept restoration before the full answer DTO is fetched. Cancellation starts a clean session.
- Added `buildSurveyRuntimeSubmission`: it serializes both ordinary root sections and repeated SectionLoop iterations, applies live visibility and EndForm projections, preserves loop variables, includes the currently active loop iteration on submit (matching legacy `storeSection(currentSection, true)`), rejects invalid sessions, and builds the generated `CreateVoterWithDetailsDto`.
- Regression coverage added for canonical-to-legacy answer projection, HasPriority ordering, Edit/temporary restore wiring, ordinary plus repeated section serialization, live visibility filtering, and invalid-session rejection.
- Validation at `f4fbd97b9483164ed64b5183b0898f2f6e201060`: production build passed; 50 test files and 293 tests passed in both [push CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45593791916) and [PR CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45593782612).
- Remaining integration boundaries: only renderer families already publishing through `QuestionRuntimeEventBus` dispatch canonical commands today; other legacy renderers still need event adapters. The final network submit orchestration (GPS, voice recording upload, partial payment, and server response/navigation) is not yet switched to the new payload builder. Keep the rollout guarded until those paths are connected and browser E2E parity is verified.


## 2026-11-25 — canonical visibility and validation reach legacy views

- The canonical-to-legacy synchronization now projects question visibility into `QuestionModel.canShow`, option visibility into `AnswerModel.canShow/dontShow`, and validation status into the legacy `invalid` signal. The canonical visibility projection takes precedence while the legacy expression path remains available before Runtime startup.
- Saved-answer restore now rejects empty `formSections` payloads. Edit/temporary restore can no longer silently start a blank canonical session when the API returns an empty voter record.
- Validation at `8bf90329c024fe4ff69ab1ade8178b63028f9c60`: production build passed; 50 test files and 295 tests passed in both [push CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45594586585) and [PR CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45594574429).


## 2026-11-25 — legacy file and dynamic-record DTO parity

- Corrected the outgoing answer DTO compatibility contract using the archived source DTOs as evidence: `dynamicDataRecordId` preserves either a string or a number instead of rejecting non-numeric record identifiers.
- Restored `fileId` in outgoing file-detail DTO serialization alongside `fileUniqueId` and stable `order`; a JSON round-trip regression test verifies the field is not lost by the DTO's `toJSON()`.
- Added the missing `VoiceRecord` saved-answer restore mapping using the same archived file-detail structure as `FileUpload`; both preserve file ID, unique ID, name, size, extension, content type, and URL metadata.
- Validation on `656c4f42e998bf74a0fe8c879dcd966ee2dd9c1f`: production build passed and both push CI ([45597068731](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45597068731)) and PR CI ([45597077217](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45597077217)) passed.
- The compatibility fields are currently added to generated model classes because the archived DTO contract is broader than the checked-in generated API model. Regenerate these classes only after the backend OpenAPI schema has been corrected to include the union ID type and fileId.


## 2026-11-25 — canonical submit orchestration

- Added `RuntimeSubmissionCoordinator` to build the payload from the latest canonical session and call the generated `VotingService.createOrEditVoterAndDetailsTask` adapter.
- Exposed `VoteComponent.submitRuntime(metadata, hooks)` as the runtime submission entry point; it refuses submission until canonical bootstrap has succeeded.
- Added a single-flight guard to prevent duplicate submissions.
- Added explicit platform hooks for GPS/poll-route/voice-record preparation and success/error callbacks. Those platform services are not silently guessed or stubbed.
- Corrected temporary-save routing after rechecking the archived `SaveTemporaryService`: both temporary and final saves call the same `savePoll` API; the DTO's `temporarySave` flag and post-save behavior distinguish them. The coordinator now sends both through the generated task endpoint and exposes `onTemporarySaved` for the host UI follow-up.
- Partial payment uses the same generated task endpoint and invokes a dedicated success callback without forcing final navigation.
- Added coordinator tests for full submit, invalid session, temporary-save separation, metadata preparation, partial callback, and duplicate-submit protection.


## 2026-11-25 — canonical submission orchestration and final verification

- Added `RuntimeSubmissionCoordinator`, which builds a payload from the latest canonical session snapshot and sends it through the generated `VotingService.createOrEditVoterAndDetailsTask` endpoint.
- Exposed `VoteComponent.submitRuntime(metadata, hooks)`. It refuses to submit unless canonical runtime bootstrap completed successfully.
- Added single-flight protection, validation/serialization rejection before network I/O, metadata preparation hooks for host-provided GPS/poll-route/voice-upload values, partial-payment success callback, temporary-save callback, and error handling.
- Rechecked archived `SaveTemporaryService`: temporary and final save use the same `savePoll` API. The DTO `temporarySave` flag distinguishes them; the coordinator now sends both through the same generated endpoint and invokes `onTemporarySaved` after success. Host follow-up still owns voice-recorder restart, notifications, and RetailAudit page refresh.
- Added tests for full submission, temporary save API semantics, invalid-session rejection, prepared GPS/voice metadata, partial-payment callback, duplicate-submit protection, and network-error cleanup.
- Latest code head before this docs update: `a256dcac4b515e25815c96b3b6a0917e30c2209b`. The previous code head `4d73fe206ac95c0f8f9f611618c1e3ab97689ae9` passed production build and all 51 test files / 301 tests in both push and PR CI. The new network-error test is running CI on the latest head.
- Known production boundary: this coordinator is a tested generated-API integration, not a complete replacement for the old SaveVoteService. The host must still provide real location acquisition/permission retry, TUS recording upload and token metadata, tracking-expression post, cookie update, submit-result navigation, hybrid error-code handling, and payment event notifications. These dependencies are not present in the new VoteComponent DI graph.
- Renderer command migration is still limited to the five renderer components currently registered (UniqueSelect, MultiSelect, DynamicAnswer, SkuCount_Dynamic, HtmlFrame). The repository does not yet contain production renderer implementations for all legacy question types, so text/numeric/date/matrix/file/payment/location/voice renderer integration and browser-level E2E parity remain rollout gates.


## Submission envelope compatibility follow-up — 2026-11-25

- The archived DataService consumes ABP's `IResponse<T>` envelope (`success`, `result`, `error`). The generated Voting proxy previously deserialized the entire envelope as the inner result DTO, silently losing both the business-success flag and nested tracking result.
- The Voting submission method now unwraps the ABP envelope while preserving `success` and `error` for the runtime coordinator. Direct DTO responses remain supported for non-ABP hosts.
- Runtime submission now treats `success: false` as a business failure even when the HTTP request completes successfully. Temporary-save, partial-payment and final-success callbacks are not invoked for rejected responses; the error hook receives the server message.
- Added regression coverage for HTTP-200 business failures and rejected temporary saves. This correction still needs CI validation before rollout.


## 2026-11-25 — expanded legacy renderer migration

- Added the shared lazy `LegacyInput` renderer for Dropdown, Point, Point_NumericScale, NPS, Rating, Emoji, HasPriority, and Matrix.
- Added image-choice aliases to UniqueSelect/MultiSelect and registered CustomMaskShortText with mask-regex and length-bound handling.
- Matrix rows resolve from the existing parent/child relationship in `VoteService.questionList`; each row emits a canonical answer event using its own question identity.
- HasPriority preserves selected-option order in its serialized comma-separated value and supports up/down reordering and maximum-selection enforcement.
- Added `SUPPORTED_QUESTION_RENDERER_TYPES` and a registry coverage test. Platform-dependent types remain explicitly unsupported rather than being wired to incomplete placeholder components.
- GitHub Actions validated the LegacyInput compile fix on commit `3b028ef30d7c0c6a8fc14a275fa422d20dd0ee53`; matrix binding and registry coverage passed CI on commit `d8017a0e51dd94060e8edbcdb379a4ec0f62e455`; static SkuCount changes are running CI on the latest head.


## 2026-11-25 — matrix and static SKU compatibility

- Matrix row radio/checkbox events now compile to canonical selected-option commands rather than plain string values. Matrix multi-numeric/text rows publish an atomic pair of commands: selected column IDs and a JSON-safe cell-value object keyed by stable option references. The question serializer expects exactly this combination to create per-column answer descriptions.
- Added a regression test for atomic matrix-cell command compilation.
- Added the static `SkuCount` renderer using the archived selected-SKU DTO shape (`questionOptionUniqueId`, `answerTitle`, `quantity`, `total`, `history`), including advance-button increment/decrement and manual-total modes. Required totals are checked before clearing the invalid state.
- Static `SkuCount` is now included in the explicit supported-renderer registry; it is no longer listed as an unsupported type.
