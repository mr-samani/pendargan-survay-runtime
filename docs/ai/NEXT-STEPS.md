# Next steps

The session controller and concrete projector now connect the pure runtime modules. The original application is checked in under `PREVIUOS_SOURCE/`; the first pass through its formula implementation is complete and recorded in `docs/architecture/LEGACY-FORMULA-COMPATIBILITY.md`.

## Immediate next milestone — integrate legacy formula and global-variable evaluation

The archived implementation is centered on:

- `LogicService.generateAnswerStates()`: creates the flat `Q{fid}.*` answer-state dictionary.
- `LogicService.replaceFormulaValues()`: substitutes answer-state tokens and assigns null to missing tokens.
- `LogicService.replaceGvarValues()`: substitutes `[%title%]` global variables before answer tokens.
- `LogicService.calculateGvars()` and `calculateFormulas()`: preserve question ownership and question-walk evaluation order.
- `ExpEvaluator`: mathjs-backed expression evaluation with legacy custom functions.

The documented token families include choice flags and aggregates, scalar text/numeric/point values, matrix cell values, SKU sums, DynamicAnswer filter placeholders, RecordsOtherForms fields, Captcha validity, and Region.UniqueId. Matrix_MultiNumeric and Matrix_MultiShortText restore now reconstruct per-option cell values from each saved row's answerDescription; the serializer writes those exact values back to answerDescription, and the formula adapter consumes the same canonical per-option map. Empty cells remain unselected and are projected as null formula values.

The flat-token projection/substitution adapter, question-owned global-variable evaluator, question-variable index, initial-value hydration, and global-variable effect-batch planner now exist. A typed legacy question-execution plan now records the archived question walk and is attached to projector output. `FilterDynamicAnswer` is compiled separately as a text template, bypasses boolean formula evaluation, and is resolved against canonical answer-state fragments plus global-variable values into typed `dynamicFilterUpdates`. Those updates now flow through the base session projection into `VoteService.synchronizeRuntimeSession`, where they replace the complete per-instance dynamic-filter state and update a reactive `QuestionModel.runtimeFieldValueFilter` signal. Switching loop instances restores the correct filter and clears stale filters; unchanged values do not increment the UI effect revision. Initial values are applied before the first root projection and when a new loop answer instance is created. The concrete projector dispatches changed global-variable answer commands atomically before action reconciliation and reevaluates to a fixed point. Previous results and Payment/filter overrides are persisted per answer instance. A `VoteService` bridge transfers Payment/filter overrides into reactive `QuestionModel` signals and rehydrates them when an answer instance is activated. A framework-agnostic `SurveyRuntimeSessionCoordinator` now owns session start, active-instance-scoped UI dispatch, next/previous navigation, reset, and accepted-transition notifications; it is tested independently of Angular. The renderer boundary now has a per-`VoteComponent` event bus, typed single/multiple-choice events, and a tested adapter that resolves API identities to canonical answer commands. The remaining live-app task is to build the definition, dependency graph, expression compilation, projector, and restored snapshots in the actual `VoteComponent` load path, then instantiate this bridge with `VoteService.synchronizeRuntimeSession` as its accepted-transition callback. This is intentionally not wired yet: the production formula-scope adapter and its legacy parity checks are not ready. In parallel, implement the missing Payment/DynamicAnswer/SkuCount_Dynamic renderers and make secondary-filter revisions drive cancellable dynamic-data requests. The UI bridge increments a question's effect revision only when its effective Payment/filter values actually change, so reactivating an unchanged loop instance does not trigger redundant renderer work. A tested `RendererRuntimeSessionBridge` now owns the ordering boundary: it starts from restored answer/loop snapshots before subscribing, resolves and dispatches renderer events through the coordinator, and releases the subscription/session on disposal. Keep these compatibility boundaries separate from canonical answer state.

### Required compatibility tests

- Global-variable token replacement now preserves markers inside quoted literals and safely handles escaped quotes; case-insensitive title matching and whitespace behavior have regression coverage.
- Global-variable dependency lookup and FormulaEngine aliases now include the legacy display title case-insensitively, even when it differs from API IDs and uniqueIdPerForm.


- Golden token maps for every question type supported by the legacy `generateAnswerStates` switch, including currently untested Point, Captcha and every matrix/dynamic variant.
- Choice selected/visible counts, answer titles, point totals, and weighted points.
- Hidden question and hidden option behavior.
- Scalar empty/null handling and numeric fallback behavior.
- Matrix text/numeric cell values.
- SKU totals and dynamic filter placeholders.
- Dynamic-filter text replacement for answer tokens, global-variable string quoting, failed global-variable fallback, and exact target resolution.
- Per-instance dynamic-filter replacement, stale-filter clearing, unchanged-value suppression, and coexistence with Payment/secondary-filter effects.
- RecordsOtherForms numeric vs quoted-string values.
- Region.UniqueId with and without a region.
- Missing-token substitution to null.
- Global-variable replacement before answer-token replacement, including string quoting, case-insensitive title replacement, and global-variable tokens already substituted before the answer-token pass.
- Wire the live runtime session into `VoteComponent` and dispatch each projection's side-effect batch through `VoteService`; activate the corresponding instance during loop navigation.
- Implement Payment/DynamicAnswer/SkuCount_Dynamic renderers that consume QuestionBase runtime signals. The transport-agnostic HTTP loader and filter-refresh coordinator now exist; connect them to the host's authenticated API transport and live renderers, then restore selections/totals according to archived component behavior.
- The dependency-aware question execution plan now drives the full evaluator. Validate cross-question dependency pull-forward and repeated Section/SectionLoop evaluation against real archived survey payloads, including action precedence.
- Complete the DynamicAnswer/SkuCount_Dynamic live integration: bind the host API transport, synchronize the active loop instance from the session lifecycle, preserve per-instance caches and successful lists, and verify late-response protection in browser-level tests.
- Connect the tested legacy function library to a supported parser extension point. A direct `createReactiveModel` scope injection attempt failed with the installed `ngx-exp-parser`; do not reintroduce that path without proving function dispatch. Then verify random(key), endsWith, startsWith, contains, avgWeakData, loose equality, and parser operators. Strict boolean action behavior is now enforced and regression-tested: non-boolean results become false action conditions rather than truthy coercions.
- Expand formula evaluation-error parity and decide whether legacy formula errors should remain warnings or block the current projection.

The legacy `new Function` branch must not be reintroduced. If the modern parser cannot express a legacy construct safely, mark it as an explicit compatibility limitation and provide a migration path.

Do not enable the compatibility adapter as the production formula scope until these fixtures and real payload checks pass.

## Then — action and visibility parity

- Verify source-order precedence for multiple SectionLoop expressions and Select/UnSelect conflicts.
- Add tests for action-triggered formula recalculation, visibility changes, hidden required questions, and action cycles.
- Extend supported action/target pairs only after their original behavior is traced.
- Preserve unsupported action proposals as explicit diagnostics.

## Next — connect the live renderer/session lifecycle

- Build the runtime definition and projector from the loaded API response without changing legacy restore semantics.
- Restore saved answers into canonical answer state before creating the session; do not start with an empty answer snapshot and overwrite restored values later.
- Instantiate `RendererRuntimeSessionBridge` only after definition compilation, projector construction, and saved-answer restoration have succeeded; it owns the scoped event subscription, reference compilation, and coordinator dispatch.
- After accepted dispatch/navigation, synchronize the active projection with `VoteService.synchronizeRuntimeSession`; rejected events must not update the UI bridge.
- Add integration tests for root and repeated SectionLoop event dispatch, instance switching, invalid references, rejected navigation, and view disposal.
- Keep the legacy `vote.form` path temporarily as a compatibility projection; do not let it become a second source of truth for the new runtime.

## Then — renderer integration

- Connect remaining renderer input/output adapters to immutable answer commands.
- Define canonical answer value shapes for Matrix, Group, SKU, DynamicAnswer, files, Payment, Captcha, and RetailAudit.
- Add renderer parity incrementally behind the lazy registry.

## Then — complete save orchestration

- Supply evaluated visibility, end-form state, and evaluated initial values to the per-question serializer.
- Reconcile generated DTO differences against the live API: dynamicDataRecordId string/number and fileId omission.
- Implement RetailAudit conversion to synthetic DynamicAnswer-like repeated pages, with temporary-save vs final-save validity filtering.
- Add full golden JSON fixtures for each supported question family.
- Integrate geo-location, poll route, audio recording, timer stop/restart, temporary save, full save, partial payment save, and response/error callbacks.
- Verify quota, EndForm/SubmitForm, PreventSubmit, post-submit tracking, and dynamic-answer filtering.

## Quality and rollout

- Add browser parity tests for repeated section navigation, answer isolation, restore/reload, and final submission.
- Compare runtime and memory metrics against the recorded bundle baseline.
- Define feature flag and rollback strategy only after behavioral parity gates pass.
