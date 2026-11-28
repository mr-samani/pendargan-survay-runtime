# Current status

**Updated:** 2026-11-28  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 5 — canonical session lifecycle, action reconciliation, DynamicAnswer/SkuCount_Dynamic request integration, FileUpload/VoiceRecord host controls, Payment host UI/runtime integration, Matrix_Dynamic renderer foundation, and RetailAudit final/temporary payload projection implemented; concrete Payment SignalR provider and remaining renderer/API/formula parity remain open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The archived application is checked in under `PREVIUOS_SOURCE/` and is the behavior reference for the rewrite. It is not the implementation target and must not be copied wholesale.
- Legacy behavior must be verified against this source and golden API payloads; do not invent semantics where source behavior is unclear.

## Work completed on this branch

- Typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Matrix_Dynamic renderer foundation: verified legacy row-major grouping, column headings from the first row, row headings from each row's first child, responsive semantic table, explicit renderers for the four legacy matrix-cell question types, live child-visibility projection for rows/columns, and archived pixel-based column sizing. Child questions are rendered only within their parent, not again at the root. Live title refresh and full visual/validation parity remain open.
- PaymentQuestionRuntime host integration foundation: HTTP adapter uses the archived PublicPollPaymentTransaction and VoterAnswerDetailValidation routes, including ConfirmPayment=8; ABP business errors and unknown transaction statuses fail closed.
- Canonical Payment partial-save path: VoteComponent.submitPartialPayment uses RuntimeSubmissionCoordinator, and the submission builder independently verifies the payment question identity plus every preceding question before allowing incomplete answers after the payment question.
- VoteService manages overlapping Payment question locks. VoteComponent now renders the Payment checkout/status UI, performs the canonical partial save, uses the verified API adapter, manages timer/popup/manual-check/cancel flows, and dispatches only the server-validated GUID plus validation key and snapshotted transaction amount into canonical answer state. Payment remains host-rendered, not part of the generic registry.
- CI workflow, repaired test aliases, and replaced stale starter specs.
- Immutable definition compilation and expression metadata compilation.
- Typed dependency graph, stable topological ordering, iterative SCC cycle detection, full-recalculation oracle, and dirty-node incremental evaluator.
- Seeded differential coverage: 100 input changes compare incremental results with the full evaluator.
- Immutable answer state with atomic commands, JSON-safe snapshots, dirty tracking, and per-runtime-instance namespaces.
- Pure visibility projection for the supported InsideForm Question/Answer Show/Hide subset.
- Select/UnSelect action resolution and atomic application with explicit conflict policies.
- Shared scalar validation rules used by both the ScalarAnswer renderer and central runtime validation: required, numeric bounds, decimal precision, text lengths, Email, Iranian Mobile, Phone, NationalCode, custom masks, and Date bounds.
- FileUpload answer validation for count, size, allowed extension, upload completion, and persisted server file IDs. TUS upload itself remains a host integration.
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
- Validation now shares scalar rules between the ScalarAnswer renderer and final runtime validation (Numeric/Point bounds, decimal precision, text lengths, Email, Iranian Mobile, Phone, NationalCode, custom masks, and Date bounds); FileUpload count/size/extension/completion/server-ID checks are also implemented.
- Unsupported actions are reported as warnings and are not silently applied.
- Added a UI effect bridge in `VoteService`: it stores Payment amount and secondary-filter overrides by answer-instance ID, activates the correct values when a root/loop instance is selected, and syncs them to reactive `QuestionModel` signals. `QuestionBase` exposes computed Payment amount, dynamic expression filter, secondary filter, and an effect revision for lazy renderers to observe.
- API DTO settings and canonical answer values are not mutated by these UI overrides. Tests cover per-instance isolation, fallback to original settings, unchanged-value suppression, batched revision updates, and preservation of unrelated overrides.
- `VoteService.synchronizeRuntimeSession(session)` provides the adapter boundary for Payment/filter effects and answer-instance activation. Payment host integration is now connected; dynamic-data request execution and the remaining DynamicAnswer/SkuCount_Dynamic/other renderer UI integrations are still tracked separately. Full renderer wiring, browser parity, and complete API save orchestration remain open.

## Known generated DTO differences

- Legacy dynamicDataRecordId supports string or number; the generated client model includes a compatibility extension preserving both types.
- Legacy file detail includes fileId, fileUniqueId, and order; the generated client model includes a numeric fileId compatibility extension.
- VoiceRecord saved-file detail restoration is implemented; recorder/token/upload host verification remains separate.

## CI validation

- Latest code CI: [run 46135839654](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46135839654) — production build and bundle attribution succeeded; 65 test files passed, 433 tests passed, 1 skipped; small/medium/large runtime profiles passed.
- Earlier milestones remain linked in the commit history and task documentation. Use the latest branch run for the current code status.

## Next work

- Build the explicit runtime-session lifecycle owner and integrate it with `VoteComponent` only after answer hydration/command wiring is complete; call `VoteService.synchronizeRuntimeSession(session)` after accepted transitions. Then implement Payment/DynamicAnswer/SkuCount_Dynamic renderers that consume the reactive `QuestionBase` signals and connect secondary-filter revisions to cancellable dynamic-data requests. Validate the adapter against real matrix answer payloads and add repeated-loop UI integration tests.
- Implement and test legacy global-variable ownership, query-parameter precedence, string quoting, initial-value/secondary-filter side effects, and evaluation ordering without global mutable leakage.
- Verify custom function parity: random key caching, endsWith, startsWith, contains, and avgWeakData.
- Connect renderer inputs/outputs to immutable answer commands.
- Supply evaluated visibility and initial values to submission.
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


## 2026-11-28 — transport-independent TUS upload lifecycle

- Inspected the archived FileUpload and VoiceRecord implementations and extracted the shared TUS contract: /FileStorage_CDN endpoint, per-file fileToken header, form/poll/id metadata, 2 MiB chunks, retry delays, one parallel upload, previous-upload resume, and fileid/fileidunique/fileaddressurl response headers.
- Added the framework-independent FileUploadRuntime and FileUploadTransport port. The runtime models immutable ready/uploading/retrying/succeeded/failed/cancelled states, progress, manual retry, cancellation, removal, disposal, and stale-callback suppression.
- Required server-issued fileid and fileidunique before an upload can enter the succeeded state. This prevents an incomplete TUS response from becoming a serializable answer.
- Added unit coverage for legacy request metadata, response header mapping, progress, failed response handling, retry, stale callbacks, cancellation, duplicate starts, configuration validation, and disposal.
- Added docs/architecture/FILE-TRANSFER.md and exported the module from the runtime barrel.
- Important boundary: this is the tested upload lifecycle core and adapter contract, not a live browser uploader. tus-js-client is not a dependency of the rewritten workspace, and the TUS HTTP stack, endpoint/token providers, and upload UI are not connected. FileUpload remains unregistered; VoiceRecord recorder capture and voice-token acquisition remain host responsibilities.


## 2026-11-28 — TUS adapter and browser voice capture

- Added TusJsFileUploadTransport, a concrete adapter for a host-supplied tus-js-client Upload constructor. It resumes prior uploads, applies the legacy PATCH content type, maps response headers, forwards progress/retry/failure, and blocks the archived terminal HTTP statuses.
- Added BrowserVoiceRecorder with permission handling, WebM/Ogg MIME negotiation, MediaRecorder lifecycle, immutable state snapshots, duration, cancellation, stale-permission/event protection, and microphone-track cleanup.
- Added the legacy recorded-voice filename helper and tests for browser capture output.
- Added tests for TUS resume, PATCH headers, progress, response-header extraction, retry classification, abort races, microphone permissions, cancellation races, and filename compatibility.
- These are tested adapters/core modules, not a live host integration. The workspace still has no tus-js-client dependency or composition root; the host must supply Upload, the legacy HTTP stack, endpoint, file/voice token DTOs, and UI callbacks. FileUpload and VoiceRecord remain unregistered pending renderer and submission wiring.


## 2026-11-28 — upload-to-answer bridge

- Extended upload snapshots with the source file extension and MIME type.
- Added a pure adapter that maps completed server uploads to the exact file-answer value consumed by the existing serializer/restorer. It converts only safe numeric server file IDs, requires fileUniqueId, and retains the archived metadata fields.
- Added immutable append/replace/remove helpers so retries or refreshed server metadata do not duplicate the same file answer.
- Added tests for successful mapping, unsafe IDs, incomplete uploads, immutable replacement/removal, video/image metadata and invalid answer shapes.
- Voice recordings can now be queued through the shared upload runtime and mapped into the same canonical FileUpload/VoiceRecord answer shape. The UI/active-instance dispatch and live host composition remain outstanding.


## 2026-11-28 — survey-aware file upload coordination

- Added SurveyFileUploadCoordinator to join the immutable SurveyDefinition source snapshots, per-question formQuestionFileUploadTokenDtos, FileUploadRuntime, and canonical file-answer adapter.
- Upload selection now resolves the server-issued token by file slot, validates allowed extensions and min/max size using the archived KB rounding rule, and enforces max file count across both current answers and concurrent in-flight/succeeded uploads.
- Successful upload states can be merged into an immutable answer array by server fileUniqueId; repeated synchronization replaces the same file instead of duplicating it. Failed/cancelled uploads never enter answers and can be retried or removed.
- Added a shared voice-upload entry point using the form's voiceRecordToken and the archived recorded_voice_{pollUniqueId}.ogg naming convention.
- Added tests for per-file token selection, archived size/extension checks, concurrent max-count enforcement, canonical answer merging, retry and disposal.
- Remaining host boundary: this coordinator is framework-independent and tested, but no Angular component currently instantiates it; the application still needs a concrete tus-js-client dependency/HTTP stack provider, CDN endpoint configuration, UI progress/delete/retry, and submission/restore end-to-end wiring. FileUpload/VoiceRecord remain unregistered.


## 2026-11-28 — upload submission safety and voice metadata

- Added a submission-readiness projection that reports every selected file upload not yet succeeded. The coordinator now fails closed while an upload is pending, retrying, failed or cancelled; callers must retry or remove it before final submission.
- Added strict voice submission mapping: exactly one successful voice upload is required, and the legacy numeric fileId plus fileUniqueId pair is returned only when both are valid.
- Added tests covering pending/failed/retried upload gating and voice token/metadata/result mapping.


## 2026-11-28 — Angular upload host and canonical answer integration

- Added an Angular composition root with explicit TUS constructor and optional custom HTTP-stack injection tokens. The endpoint is resolved from `AppConsts.remoteBaseUrl` and preserves the archived `/FileStorage_CDN` route.
- Added `provideSurveyFileTransfer(Upload)` so the consuming app can register its real `tus-js-client` constructor without coupling the framework-independent runtime to a package import or browser global.
- VoteComponent now creates a per-survey transfer coordinator when the host is configured, exposes file upload/retry/cancel/remove and browser voice recording methods, and commits completed file answers through the canonical runtime bridge.
- Successful voice uploads are projected into `voiceRecordFileIdUnique` submission metadata. Final submission now has an explicit readiness hook after metadata preparation and before DTO construction/network I/O.
- Added a fail-closed check that every successful question-file upload is present in the canonical answer for the same answer instance.
- Scoped question uploads and answer merging by loop answer-instance ID, preventing files uploaded in one repeated section iteration from leaking into another.
- Added tests for host construction, CDN endpoint/token/metadata, upload-state subscriptions, repeated-section isolation, and submission readiness gating.
- Important remaining integration boundary: this repository does not install `tus-js-client` as a dependency and does not register the provider in app.config. The consuming host must install the package and call `provideSurveyFileTransfer(Upload)`. The file/voice UI renderers and full browser E2E remain outstanding.


## File and voice transfer integration update (2026-11-28)

- Added and locked `tus-js-client@4.3.1` as a production dependency; the host lazy-loads it on demand.
- Connected the production TUS adapter to `AppConsts.remoteBaseUrl + /FileStorage_CDN`, retaining optional constructor and HTTP-stack overrides.
- Added built-in FileUpload and VoiceRecord controls in the vote host, including selection/recording, progress, retry, cancel and remove.
- Added zoneless signal refresh for upload progress and recording state.
- Routed FileUpload and VoiceRecord questions through the host controls rather than the generic lazy renderer registry.
- Added instance-targeted runtime dispatch so an upload completing after SectionLoop navigation is committed to the answer instance that started it.
- Connected successful voice upload metadata to final submission and retained fail-closed checks for incomplete uploads and missing canonical file answers.
- Updated the upload architecture guide. Unit/build CI is being re-run for this integration batch.

**Still pending:** real browser/CDN verification with valid file tokens, microphone permission/device coverage, camera capture, Xamarin/KBrowser bridges, and visual audio preview/playback. Do not claim live upload success until a real target-environment request has passed.


## Dynamic-data runtime integration — 2026-11-28

- Connected the accepted canonical session projection to `DynamicDataRefreshCoordinator` in `VoteComponent`.
- Registers DynamicAnswer and SkuCount_Dynamic definitions from the immutable source snapshots before starting the canonical session.
- Activates the current root/SectionLoop answer-instance namespace before issuing any filter-driven request. Switching loop instances cancels outstanding requests from the previous namespace while preserving its cached successful result.
- Applies evaluated `FilterDynamicAnswer` text templates to the autocomplete endpoint and applies global-variable secondary-filter effects to the SKU initial-list endpoint.
- Keeps the two request modes and their deduplication keys separate; unresolved legacy tokens are not sent to the server.
- Dynamic renderer controllers continue to subscribe to instance/question-scoped request snapshots, so a request issued by the session projection before the renderer mounts is still visible when the renderer initializes.
- Dynamic-data service resolution is deferred until a survey with a valid form definition starts, avoiding eager HttpClient dependency construction in non-runtime component/test contexts.

Validation at `cacba27ad7f84a1839b97f187efa94f2bed26da0`: production build passed; 59 test files and 364 tests passed in GitHub Actions run [46124044512](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46124044512).

**Still pending:** browser-level verification of dynamic filter changes against the live API, renderer behavior under rapid filter changes and SectionLoop backtracking, and migration of unsupported renderer families. The PR remains Draft and unmerged.

## Runtime hot-path indexing — 2026-11-28

- Replaced repeated per-filter scans of all survey questions with one target-key index per dynamic-filter projection. Duplicate target keys remain represented as multiple matches, preserving the ambiguous-target diagnostic rather than silently choosing one.
- Replaced repeated global-variable result searches with an ID map and a failed-variable ID set.
- Replaced per-section filtering of the full question list during submission with one section-alias index and one pass that groups questions by section. All three supported references (section uniqueIdPerForm, sourceId, and canonical id) remain supported; a question is not duplicated when aliases resolve to the same section.
- Added regression tests for ambiguous dynamic-filter targets and each section-reference alias.

Validation at `6b5ea30738ab50ada0e2086c84c04654288974d8`: production build passed; 59 test files and 366 tests passed in GitHub Actions run [46124179250](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46124179250).

No numeric speedup is claimed: these changes reduce repeated scans and improve algorithmic scaling, but a representative before/after benchmark has not yet been run.

## Canonical answer-to-legacy projection indexing — 2026-11-28

- Replaced per-projected-option linear searches through legacy question options with per-question indexes for uniqueIdPerForm and source IDs.
- Replaced repeated visibility-option searches with an ID lookup map.
- The indexes preserve first-match behavior for duplicate legacy IDs by retaining the earliest option index.

Validation at `afa143f06a13051c176e27b4da1aafe10c6de69d`: production build passed; 59 test files and 366 tests passed in GitHub Actions run [46124323736](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46124323736).

Benchmark status is unchanged: no percentage improvement is claimed until a reproducible before/after benchmark is run.

## Formula-scope allocation reduction — 2026-11-28

- Cached immutable question metadata by definition-question object using a WeakMap, allowing repeated formula projections to reuse the same frozen metadata records.
- Cached option-ID-to-index lists by the immutable options array. Formula scope now resolves only selected option IDs, restores original definition order, and preserves duplicate option entries rather than scanning every option on every projection.
- Added coverage for metadata identity reuse and selected-option ordering. Existing tests continue to verify that answer scopes and loop-variable snapshots remain isolated.

Validation at `4a5e5d8d96393d15265be24662e722b0e0e35660`: production build passed; 59 test files and 367 tests passed in GitHub Actions run [46124424167](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46124424167).

No percentage speedup is claimed pending a reproducible before/after benchmark.

## Incremental evaluator compatibility hardening — 2026-11-28

- Reviewed the stateful incremental evaluator against the full evaluator and dependency graph before attempting production wiring.
- Corrected dynamic-answer filter handling: templates are retained from the initialized full snapshot and are not executed as boolean expressions during incremental updates.
- Corrected action semantics: only literal boolean `true` activates an action; non-boolean results remain false and emit the same warning as the full evaluator.
- Matched the full evaluator's global-variable alias set, including display title and lowercase display title, so incremental formula evaluation resolves the same variable names.
- Added regression coverage for dynamic-filter template retention and non-boolean action conditions.
- Updated the incremental-evaluator and performance architecture notes.

**Integration gate:** `ConcreteSurveyRuntimeProjector` still uses the full evaluator. It does not yet receive explicit changed-node IDs, and its evaluation scope changes with the active answer instance and SectionLoop variables. Wiring incremental state before answer-diff derivation and invalidation for loop context, definition revisions, formula failure/recovery, and legacy runtime effects would risk stale results. Keep the full evaluator as the production path until those contracts are implemented and differential tests cover the complete projector output.

No speedup percentage is claimed. Production runtime integration and a reproducible large-survey benchmark remain pending.

## Full formula evaluator index caching — 2026-11-28

- Added a WeakMap cache keyed by immutable dependency-graph and expression-compilation object identity.
- Reused formula-node lookup, incoming dependency adjacency, global-variable alias lookup, and per-variable alias lists across answer/loop projections.
- Kept all mutable evaluation state local to each call; no formula values, answer scopes, diagnostics, or action proposals are shared between projections.
- The production projector continues to use the full evaluator, so this optimization applies directly to the current runtime path without requiring unsafe incremental-state reuse.

Validation at `9ca639ce862b8cc39d78e20cd9d669f2475111a`: production build passed; 59 test files and 369 tests passed in GitHub Actions run [46124885263](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46124885263). No numeric speedup is claimed before a reproducible benchmark.

## Formula dependency and question execution-plan indexing — 2026-11-28

- Full evaluator plans now pre-index only potentially unavailable formula dependencies (global-variable and unresolved external-variable nodes), preserving graph edge order and the first-unavailable diagnostic while excluding question/option inputs from each formula's runtime check.
- Predecoded global-variable dependency IDs remove repeated prefix parsing and string slicing in the per-formula hot path.
- Rebuilt the legacy question execution plan around one question-owner index and one source-order pass over expressions/global variables.
- Shared Section/SectionLoop expressions are still repeated in every question step and retain source order.
- Reverse dependency adjacency is now built once per plan rather than once per question. Dependency closure traversal is iterative, avoiding recursion overflow on very deep graphs.
- Added a 12,000-node dependency-chain regression test alongside the existing source-order, repeated-section, and dependency-closure tests.

Implementation commit 77fb39126b2d59cfedf7c88bb3ee9fd7c9099988 passed production build and 59 test files / 370 tests in GitHub Actions run [46125518889](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46125518889). Documentation-only follow-up CI is running. No benchmark percentage is claimed; the reproducible before/after large-survey benchmark remains pending.

## 2026-11-28 — action target lookup indexing

- Replaced repeated question and option scans in Select/UnSelect action resolution with definition-scoped WeakMap indexes.
- Question aliases include sourceId, uniqueIdPerForm and canonical id; option aliases include uniqueIdPerForm, sourceId and canonical id.
- Indexes preserve the previous first-match semantics for duplicate aliases by inserting only the first match in definition order.
- The cache is keyed by immutable SurveyDefinition identity, so a new definition revision gets a fresh index and unused definitions remain collectible.
- Added regression tests for duplicate aliases and all supported reference forms.
- CI for this change is queued; PERF-003 remains open until production build and tests pass. No wall-clock speedup is claimed before the reproducible benchmark is run.

## Superseding integration and performance update — 2026-11-28

The following updates supersede older historical notes above where they describe work as not yet wired:

- DynamicAnswer and SkuCount_Dynamic are connected to the live VoteComponent session projection and instance-scoped DynamicDataRefreshCoordinator. The Angular HttpClient transport uses the configured API base URL/interceptor chain; live API/browser parity under rapid changes and SectionLoop backtracking remains pending.
- tus-js-client 4.3.1 is installed and lazy-loaded. The production TUS transport uses the configured legacy CDN route. VoteComponent provides FileUpload and VoiceRecord host controls for selection/recording, progress, retry, cancel and remove; completed files are committed to the originating answer instance and submission is fail-closed.
- Live CDN/device/browser verification, audio preview/playback compatibility and Xamarin/KBrowser bridge verification remain outstanding. Unit tests of adapters and host controls do not prove production service availability.
- Select/UnSelect target resolution now uses cached definition-scoped question/option alias indexes. The indexes preserve first-match behavior for duplicate aliases. CI run [46126983661](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46126983661) passed production build and 59 test files / 373 tests.
- The stateful incremental evaluator remains intentionally out of the production projector. The next performance milestone is a reproducible anonymized benchmark baseline; no percentage speedup is claimed for the indexing changes.
- The remaining major gaps include Payment, Matrix_Dynamic and other host-dependent/composite renderers, complete formula parser/custom-function parity, full golden API payload fixtures, live browser E2E, accessibility and rollout gates.

## 2026-11-28 — action resolution benchmark and CI

- Added a versioned synthetic microbenchmark for the old linear question/option target lookup versus the definition-scoped cached-index resolver.
- Fixture: 2,000 questions, 8,000 options, 1,500 distinct Select actions; 3 warmups and 15 measured iterations.
- CI run [46127175859](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46127175859) passed production build and 60 test files / 374 tests.
- On Node v24.22.3 / npm 11.19.1, linear reference p50/p95/p99 was 16.17/17.60/17.60 ms; indexed resolver was 1.40/5.26/5.26 ms. Mean was 15.05 ms vs 1.84 ms. Cold index construction plus first resolve was 9.13 ms. Median ratio: 11.55x.
- This is a synthetic Node microbenchmark for one lookup path only; it is not a full runtime or browser speedup claim.
- Latest production build reports 965.12 kB initial raw / 245.69 kB estimated transfer, over the 500 kB warning budget by 465.12 kB. The unnamed 430.24 kB initial chunk still needs source attribution; CommonJS warnings include url-parse (TUS) and sanitize-html.
- Full runtime baseline remains open: compile, expression evaluation, complete projector update, memory, browser timings and per-renderer request/chunk profiles have not yet been measured.

## 2026-11-28 — shared definition indexes for visibility

- Added a shared WeakMap-cached definition index for question references, action option aliases, visibility option aliases and section membership.
- Refactored Select/UnSelect action resolution to reuse the shared index rather than owning a separate cache.
- Refactored visibility target resolution to use first-match question/option lookups and replaced per-section full-question filtering with one section-alias grouping pass.
- Indexed formula execution results by formulaId for missing-condition diagnostics while preserving first-match behavior.
- Kept action and visibility option alias contracts separate: actions match uniqueIdPerForm/sourceId/id; visibility matches uniqueIdPerForm/id only.
- Added regression tests for duplicate question/option aliases and questions belonging to multiple sections through colliding aliases.
- CI run [46127388932](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46127388932) passed production build and 60 test files / 377 tests.
- No standalone wall-clock speedup is claimed for this stage; the action-resolution microbenchmark does not measure the full visibility projector.


## 2026-11-28 — full runtime benchmark and bundle-statistics instrumentation

- Added an opt-in full-runtime profile benchmark for anonymized small (20 questions), medium (250 questions) and large (2,000 questions) surveys.
- The harness measures cold definition/expression/graph compilation, warm full formula evaluation, full projector evaluation and one-answer projector propagation. It reports p50/p95/p99, fixture and graph dimensions, Node/platform details, and retained heap delta.
- The heap delta is intentionally labeled as noisy because CI does not force garbage collection. No browser speedup or production workload claim is inferred from these synthetic Node fixtures.
- CI now runs the profile benchmark and builds with source maps. Angular 22 accepted --stats-json but emitted no stats.json; that failed collection step was replaced with tools/analyze-bundle-sources.mjs, which writes a source-to-chunk attribution report uploaded as a 14-day artifact. The report is still awaiting a successful run and inspection.
- Previous bundle observation remains: 965.12 kB initial raw, 245.69 kB estimated transfer, with a 430.24 kB unnamed initial chunk. Its module source is not yet known and must be established from stats, not guessed.

## 2026-11-28 — browser verification boundary

- Added docs/development/BROWSER-E2E.md to distinguish deterministic fake-transport tests from actual browser E2E and live CDN/device verification.
- Existing session coordinator, renderer bridge, Dynamic Data, TUS host/adapter, upload state machine and MediaRecorder tests provide deterministic regression coverage. VoteComponent's current test is only a shallow component-creation test.
- CI still does not launch Chromium. E2E-001 remains open until a real browser runner covers session startup/restore, SectionLoop navigation, renderer-to-session synchronization and dynamic-data request races.
- UPLOAD-011/012 remain open until a disposable staging poll, valid file tokens, configured CDN, microphone permission and playback/device checks are available. Unit tests do not establish live-service compatibility.


## Bundle attribution correction

The initial stats-json collection attempt failed because the Angular 22 application builder did not emit a stats.json file. The CI step has been replaced with production source maps plus a repository-owned attribution script. The script reports the source modules associated with each emitted chunk and their original source-content sizes; it explicitly does not present those sizes as exact post-tree-shaking bundle contributions. The new CI run must pass and the report must be inspected before selecting a bundle optimization.


## 2026-11-28 — first full runtime profile and bundle attribution results

CI run [46128065393](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46128065393) passed production build, source-map attribution generation and all tests: 61 test files, 380 passed, 1 skipped. Runtime profile benchmark on Node v24.22.3 / Linux x64 (3 warmups, 12 measured iterations):

| Profile | Cold compile | Full evaluation p50/p95 | Full projector p50/p95 | One-answer projector propagation p50/p95 |
|---|---:|---:|---:|---:|
| Small (20 questions) | 6.641 ms | 0.057 / 0.067 ms | 0.352 / 0.902 ms | 0.304 / 1.182 ms |
| Medium (250 questions) | 30.705 ms | 0.184 / 0.554 ms | 3.032 / 4.658 ms | 2.920 / 7.905 ms |
| Large (2,000 questions) | 199.307 ms | 0.993 / 1.315 ms | 82.341 / 85.469 ms | 83.339 / 86.240 ms |

The large fixture contains 10,000 options, 400 expressions, 12,800 graph nodes and 400 graph edges. One-answer propagation deliberately invokes the complete projector; this is the pre-incremental baseline, not an incremental evaluator speedup. Heap deltas (+4.89 MiB, -17.41 MiB, -8.83 MiB) are noisy retained-heap measurements without forced GC and must not be used as allocation claims.

The production bundle in this run is 966.00 kB raw / 246.15 kB estimated transfer. The initial chunks are 534.10 kB main, 430.33 kB unnamed, and 1.45 kB. Source-map attribution identifies large source inputs in the unnamed chunk: Angular Core debug-node chunk, Luxon, Angular Core and ngx-exp-parser. The main chunk maps to Angular Router, Forms, Common, ngx-kit core and sanitize-html. TUS is in a separate lazy chunk (~60.34 kB), so url-parse/TUS is not the source of the 430.33 kB initial chunk.

These are source-map candidate associations, not exact post-tree-shaking retained byte contributions. No bundle dependency has been removed yet. Next is to trace the import edges that pull Luxon and Angular debug-node code into the initial graph and measure one isolated change at a time.

## CI benchmark correction

The first benchmark CI attempt failed at TypeScript compilation because the project intentionally does not include Node type declarations. The benchmark now declares only the small Node process surface it uses; the corrected run above passes. No dependency or tsconfig-wide Node type change was needed.


## 2026-11-28 — Payment question runtime foundation

- Added projects/vote/src/app/runtime/payment/PaymentQuestionRuntime as a framework-agnostic state machine based on the archived PaymentQuestionComponent and transaction DTO contract.
- Implemented partial-save-before-checkout ordering, one-time partial save reuse on retry, transaction create/get, gateway URL handoff, transaction ID correlation, SignalR status acceptance, manual status refresh, ConfirmPayment server validation, GUID answer publication, cancellation, expiry and previous-question lock/unlock transitions.
- Added duplicate-operation guards and disposal/late-response protection. Only a valid server-issued GUID becomes the canonical answer; the transaction ID remains the validation key.
- Formula-driven payment amount can be refreshed before checkout. The exact amount used to create a transaction is snapshotted and reused for validation even if a later runtime formula changes the displayed amount.
- Optional payment questions do not block validation before payment; required payment questions do.
- Added deterministic regression tests for partial save ordering/retry, preview and invalid-answer guards, transaction creation, SignalR correlation, server validation, amount changes, manual status refresh, cancellation, server expiry, duplicate checkout and disposal races.
- The host lifecycle uses an optional `PAYMENT_SIGNALR_CONNECTOR` port with archived event parsing and safe teardown. A concrete SignalR client/provider and live gateway verification remain open under RENDER-004b.
- Added source-verified RetailAudit submission conversion: eligible selected products expand into backend repeated-section pages, each with a synthetic DynamicAnswer row and recursively flattened child answers. Final/partial saves include only `formValid === true`; temporary saves also retain explicitly attempted `false` rows and omit `undefined` rows. Product dynamic-record IDs and per-product `retaliVariables` are preserved.
- RetailAudit saved-answer reconstruction now rebuilds arbitrarily nested Matrix/Matrix_Dynamic/Group descendants by backend parent IDs, with cycle protection; submission recursively flattens those descendants exactly once. A three-level restore-to-submit regression fixture covers the round trip.
- Dynamic-data registration now recognizes RetailAudit as a distinct `retail-audit-autocomplete` mode and routes expression filters through the archived V2 autocomplete endpoint contract. The SKU record-ID initial-list path remains separate; RetailAudit is deliberately not added to the supported renderer list until duplicate selection and per-product child-answer isolation are implemented. Existing DynamicAnswer/SkuCount renderer controller types now explicitly exclude this third mode so it cannot accidentally enter a single-answer or SKU-list controller.
- Required RetailAudit questions now fail validation when any selected product has incomplete child answers. Optional RetailAudit questions preserve the legacy optional behavior.


Latest code validation: CI run [46135839654](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46135839654) passed production build, bundle attribution generation, 65 test files, 433 tests passed and 1 skipped. It includes Payment UI/runtime integration, dynamic payment amount serialization, 10 Matrix_Dynamic layout/visibility tests, RetailAudit final/temporary conversion, exact payload assertions, restore-to-submit round trip, nested container restoration (including three-level Matrix/Group trees), selected-choice validity, required-answer validation, and fail-closed Payment partial-save ordering tests covering valid, invalid, missing and ambiguous predecessor states. Existing small/medium/large runtime profiles also passed.
