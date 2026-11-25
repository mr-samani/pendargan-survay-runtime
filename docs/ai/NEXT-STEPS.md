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

The flat-token projection/substitution adapter, question-owned global-variable evaluator, question-variable index, initial-value hydration, and global-variable effect-batch planner now exist. A typed legacy question-execution plan now records the archived question walk and is attached to projector output. `FilterDynamicAnswer` is compiled separately as a text template, bypasses boolean formula evaluation, and is resolved against canonical answer-state fragments plus global-variable values into typed `dynamicFilterUpdates`. Those updates now flow through the base session projection into `VoteService.synchronizeRuntimeSession`, where they replace the complete per-instance dynamic-filter state and update a reactive `QuestionModel.runtimeFieldValueFilter` signal. Switching loop instances restores the correct filter and clears stale filters; unchanged values do not increment the UI effect revision. Initial values are applied before the first root projection and when a new loop answer instance is created. The concrete projector dispatches changed global-variable answer commands atomically before action reconciliation and reevaluates to a fixed point. Previous results and Payment/filter overrides are persisted per answer instance. A `VoteService` bridge transfers Payment/filter overrides into reactive `QuestionModel` signals and rehydrates them when an answer instance is activated. A framework-agnostic `SurveyRuntimeSessionCoordinator` now owns session start, active-instance-scoped UI dispatch, next/previous navigation, reset, and accepted-transition notifications; it is tested independently of Angular. The renderer boundary now has a per-`VoteComponent` event bus, typed single/multiple-choice events, and a tested adapter that resolves API identities to canonical answer commands. The `VoteComponent` now attempts this guarded bootstrap after legacy question initialization, and starts `RendererRuntimeSessionBridge` with `VoteService.synchronizeRuntimeSession` as its accepted-transition callback when compilation and initial projection succeed. The structured formula scope and saved-voter restore path are not yet proven equivalent to legacy behavior; failed bootstrap logs diagnostics and leaves the legacy question view operational. DynamicAnswer and SkuCount_Dynamic now have standalone lazy renderers connected to the request/controller/event boundaries. The UI bridge increments a question's effect revision only when its effective Payment/filter values actually change, so reactivating an unchanged loop instance does not trigger redundant renderer work. A tested `RendererRuntimeSessionBridge` now owns the ordering boundary: it starts from restored answer/loop snapshots before subscribing, resolves and dispatches renderer events through the coordinator, and releases the subscription/session on disposal. Keep these compatibility boundaries separate from canonical answer state.

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
- Implement Payment/DynamicAnswer/SkuCount_Dynamic renderers that consume QuestionBase runtime signals. The Angular HttpClient transport and filter-refresh coordinator are now provided through root DI and use the configured API base URL/interceptors; connect them to live renderers, then restore selections/totals according to archived component behavior.
- The dependency-aware question execution plan now drives the full evaluator. Validate cross-question dependency pull-forward and repeated Section/SectionLoop evaluation against real archived survey payloads, including action precedence.
- Complete the DynamicAnswer/SkuCount_Dynamic browser parity work: verify the standalone renderers against real DTO fixtures, late HTTP responses, form validation, selection clearing, SKU sorting/history and multiple loop instances. Current renderer subscriptions are instance-scoped and the loader rejects stale writes; browser-level end-to-end coverage remains open.
- Connect the tested legacy function library to a supported parser extension point. A direct `createReactiveModel` scope injection attempt failed with the installed `ngx-exp-parser`; do not reintroduce that path without proving function dispatch. Then verify random(key), endsWith, startsWith, contains, avgWeakData, loose equality, and parser operators. Strict boolean action behavior is now enforced and regression-tested: non-boolean results become false action conditions rather than truthy coercions.
- Expand formula evaluation-error parity and decide whether legacy formula errors should remain warnings or block the current projection.

The legacy `new Function` branch must not be reintroduced. If the modern parser cannot express a legacy construct safely, mark it as an explicit compatibility limitation and provide a migration path.

Do not enable the compatibility adapter as the production formula scope until these fixtures and real payload checks pass.


### Dynamic question domain runtime

The dynamic-question domain layer now covers the two archived question DTO types without inventing renderer markup:
- DTO registration derives the stable question key from `uniqueIdPerForm` (falling back to `uniqueId`), the catalog key from `dynamicDataUniqueId`, and the correct mode from `DynamicAnswer` / `SkuCount_Dynamic`. Unsupported and incomplete questions are ignored.
- DynamicAnswer reconciliation restores by `identificationCode`, flags options already selected in earlier SectionLoop iterations, and supports the legacy auto-select-first behavior without selecting a reserved record.
- SKU reconciliation merges initial-list results with the selected rows, preserves quantity/history/manual totals, restores saved totals, and sorts by server ordering without duplicates.
- Immutable SKU domain operations cover add/remove, increment/decrement with legacy history entries, manual total edits, aggregate total, and required-answer validation. A total of zero remains valid; null/undefined/empty remains invalid.
- The implementation now has a renderer-facing `DynamicDataRendererController`: it owns one answer-instance/question pair, exposes a snapshot stream, starts the correct initial request path, accepts DynamicAnswer selection only from current available options, enforces reserved SectionLoop IDs, and publishes immutable SKU list operations through one callback. It remains a tested host adapter, not a production Angular template or VoteComponent bootstrap hookup.

### Dynamic-data request parity correction

The refresh coordinator now keeps the two archived SKU request paths distinct:
- `FilterDynamicAnswer` expression changes always use the autocomplete payload (`fieldToSearchIn: DynamicExpression`, `fieldValueFilter`), including when the target renderer is SkuCount_Dynamic.
- Global-variable secondary-filter changes use the SKU initial-list payload (`recordIdArrayToGet`) and are rejected for non-SKU registrations.
- Expression and secondary-filter deduplication keys are separate, so equal text in two semantically different filters cannot suppress the required request.
- Unregistering a question removes only that question's instance-scoped cache entries; cache keys are parsed structurally rather than matched by a string suffix.

Regression tests cover SKU expression-vs-initial-list payloads, same-text cross-mode refreshes, loop-instance cache isolation, unresolved placeholder cancellation, unsupported secondary-filter targets, and safe unregister behavior.

The renderer-facing controller now consumes the data-service boundary and exposes selection/SKU actions and a per-question snapshot stream. It does not yet own Angular templates, subscribe to `QuestionBase` filter signals, or dispatch its answer callback through the runtime session; do not claim full end-to-end parity.

## Then — action and visibility parity

- Verify source-order precedence for multiple SectionLoop expressions and Select/UnSelect conflicts.
- Add tests for action-triggered formula recalculation, visibility changes, hidden required questions, and action cycles.
- Extend supported action/target pairs only after their original behavior is traced.
- Preserve unsupported action proposals as explicit diagnostics.

## Next — connect the live renderer/session lifecycle

- The `VoteComponent` now builds the runtime definition, expression graph and projector after the legacy form has initialized. It currently starts a fresh canonical answer snapshot; wire saved-voter/temp-voter restoration before enabling canonical session startup for edit/resume flows.
- Validate the formula scope against production `@Q...` expressions and complete the legacy token adapter before treating successful bootstrap as formula parity.
- Keep the bridge guarded: it subscribes only after a successful session start and owns scoped event dispatch and active-instance derivation.
- After accepted dispatch/navigation, synchronize the active projection with `VoteService.synchronizeRuntimeSession`; rejected events must not update the UI bridge.
- Add integration tests for root and repeated SectionLoop event dispatch, instance switching, invalid references, rejected navigation, and view disposal.
- Keep the legacy `vote.form` path temporarily as a compatibility projection; do not let it become a second source of truth for the new runtime.

## Then — renderer integration

- Connect remaining renderer input/output adapters to immutable answer commands. DynamicAnswer and SKU now use the canonical `question-value` event; Matrix, Group, files, Payment, Captcha, and RetailAudit remain to be integrated.
- Define and golden-test canonical answer value shapes for all remaining question families.
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


## Next integration slice

1. Feed restored GetVoterFullDetail data into canonical session startup for edit and accepted temporary-save flows; preserve the existing user consent step for temporary data.
2. Reconcile canonical answers back into the legacy QuestionModel adapter so renderer state, formulas, validation and submission cannot diverge.
3. Complete loop-aware formula/global-variable evaluation and per-instance dynamic-filter refresh.
4. Add browser-level tests for restore → answer → SectionLoop navigation → submit serialization.
