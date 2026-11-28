# Next steps

## Current execution focus — 2026-11-28

The latest runtime integration has advanced beyond the older sections below: DynamicAnswer/SkuCount_Dynamic refresh requests are connected to the accepted canonical session projection, the Angular HTTP transport is registered through the app's interceptor chain, and definition-scoped action/visibility indexes are in place. Payment now has its verified HTTP adapter, ordered partial-save guard, canonical partial-save host method and previous-question lock bridge. Matrix_Dynamic has a source-verified row-major renderer foundation. Treat the dated historical notes below as implementation history, not as the current checklist.

1. Finish Payment UI integration: add a lifecycle-safe SignalR connection/subscription, timer scheduling, gateway popup fallback, and bridge the server-issued validation GUID into the canonical answer session. Keep Payment unregistered until all of this is tested.
2. Finish Matrix_Dynamic parity: implement runtime title/description refresh, complete child validation and golden submission/restore payloads against archived fixtures. ColumnSize pixel semantics and row/column visibility are already implemented.
3. Complete RetailAudit and nested saved-answer restore, temporary/full/partial-payment orchestration and golden payload round trips (API-001/003/004/005/006).
4. Finish legacy formula parser/function and scope parity, retaining the full evaluator as the production oracle (SESSION-002).
5. Continue the remaining source-verified renderer families (RecordsOtherForms, Chart, Group and popup-section behavior).
6. Keep the owner's deferred tracks deferred: bundle import-chain tracing, Chromium E2E setup, live CDN/Voice staging and device playback verification.

Do not wire the stateful incremental evaluator into the production projector until changed-answer node derivation and invalidation for active answer instances, loop variables, definition revisions, formula failure/recovery and legacy runtime effects are covered by differential tests.

---

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

- The `VoteComponent` now builds the runtime definition, expression graph and projector after the legacy form has initialized. The pure `restoreSurveyFromBackend` adapter restores saved answer DTOs, repeated-section answer instances, and per-iteration `voterVariables`; the live edit/temp-resume loading path and legacy QuestionModel hydration are still not wired. Keep canonical startup guarded for edit/resume flows until both are connected.
- Validate the formula scope against production `@Q...` expressions and complete the legacy token adapter before treating successful bootstrap as formula parity.
- Keep the bridge guarded: it subscribes only after a successful session start and owns scoped event dispatch and active-instance derivation.
- After accepted dispatch/navigation, synchronize the active projection with `VoteService.synchronizeRuntimeSession`; rejected events must not update the UI bridge.
- Add integration tests for root and repeated SectionLoop event dispatch, instance switching, invalid references, rejected navigation, and view disposal.
- Keep the legacy `vote.form` path temporarily as a compatibility projection; do not let it become a second source of truth for the new runtime.

## Then — renderer integration

- Connect remaining renderer input/output adapters to immutable answer commands. UniqueSelect/MultiSelect, scalar text/numeric/date/time families, DynamicAnswer and SKU now publish canonical events. CustomMaskShortText, Matrix, Group, files, Payment, Captcha, Location, Rating, VoiceRecord, and RetailAudit remain to be integrated.
- Define and golden-test canonical answer value shapes for all remaining question families.
- Add renderer parity incrementally behind the lazy registry.

## Then — complete save orchestration

- Supply evaluated visibility, end-form state, and evaluated initial values to the per-question serializer.
- The archived DTO contract's `dynamicDataRecordId: string | number` and file-detail `fileId` are now preserved by compatibility extensions in the generated client models. Confirm these fields against the live backend OpenAPI schema before regenerating the client; do not let code generation silently remove them.
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


## 2026-11-25 — lifecycle integration follow-up

1. Connect remaining host-dependent renderers: file upload/TUS, payment gateway, CAPTCHA provider, geolocation/map, voice recording, cross-form lookup, RetailAudit and composite section navigation. Scalar, choice, scale, rating, emoji, priority, basic matrix and static SkuCount renderers are already registered.
2. Replace direct legacy answer mutation as the source of truth; keep `QuestionModel` and `vote.form` as projections only.
3. Wire `buildSurveyRuntimeSubmission` into the actual submit/temp-save/partial-payment orchestration, preserving GPS, voice-record upload, allocation, poll-route, and server error behavior.
4. Complete formula parser function parity and loop-local formula scopes, including the remaining archived @Q aliases.
5. Add browser E2E coverage for new survey, Edit restore, accepted/cancelled temporary restore, renderer changes, SectionLoop navigation/backtracking, validation, and final submit payload parity.


## Additional UI synchronization gates

- Verify every legacy renderer template consumes the canonical visibility and validation projections without mutating source DTO fields.
- Add tests for active loop instance switching across question visibility, option visibility, validation, and answer hydration.
- Continue renderer event migration; until every answer-producing renderer emits canonical commands, the legacy model is still a compatibility projection for only the integrated renderer families.


## 2026-11-25 — DTO compatibility follow-up

- Dynamic record IDs now preserve both strings and safe integers across DynamicAnswer, SkuCount_Dynamic, and section-scoped question answers. Unsupported object/boolean IDs fail explicitly rather than being coerced.
- File answer serialization retains numeric `fileId` plus `fileUniqueId` and ordering; the DTO JSON serialization path is covered.
- VoiceRecord restore is implemented against the same archived file-detail structure as FileUpload. The remaining voice-record work is upload/session orchestration and browser-level verification, not basic saved-answer hydration.


## Canonical submission integration follow-up

- The canonical submission DTO is now wired to the generated `VotingService.createOrEditVoterAndDetailsTask` through `RuntimeSubmissionCoordinator`, with an entry point on `VoteComponent`.
- Remaining app-specific adapters: real location permission/retry flow, TUS/voice recorder upload, separate temporary-save service, tracking-expression post, cookie and submit-result navigation, hybrid error-code handling, and payment event bus wiring. These cannot be inferred from the new runtime's current DI graph and must be connected to the actual host services before replacing the archived SaveVoteService end-to-end.
- Renderer command migration remains limited to the five registered renderer implementations. Unsupported question types are not falsely marked as migrated.


## Final integration gates after the canonical submit coordinator

1. Implement or connect host adapters for location permission/retry, TUS voice upload, tracking-expression reporting, cookie handling, submit-result navigation, hybrid error handling, and payment event notifications.
2. Migrate each actual legacy renderer as it is ported into this repository; only the currently registered renderer components publish canonical answer events.
3. Add browser-level E2E parity for new survey, Edit restore, temporary restore/cancel, repeated SectionLoop navigation/backtracking, dynamic data isolation, and final/partial/temporary submit.
4. Verify generated DTO extensions (`dynamicDataRecordId: string | number`, file `fileId`) against backend OpenAPI before regenerating service proxies.
5. Resolve the initial bundle budget warning and `sanitize-html` CommonJS warning after the runtime behavior is stable.


## Submission response contract correction

The archived `DataService.post` returns an ABP `IResponse<T>` envelope, not the inner DTO directly. The Voting submission proxy now unwraps `result` and carries `success/error` into the runtime coordinator. The coordinator rejects business-level failures before invoking temporary-save, partial-payment, or final-success callbacks. Regression tests cover rejected final and temporary saves. Keep this proxy adaptation when regenerating API clients, or move the same unwrapping into the code generator/template.


## 2026-11-25 — scalar renderer slice

- Added the shared lazy `ScalarAnswer` renderer for ShortText, LongText, Numeric, Date, Time, Email, Phone, Mobile, NationalCode, and PostalCode.
- Scalar changes and explicit clears use the same per-view event bus and canonical `set-value` adapter as DynamicAnswer/SKU. The session bridge owns answer-instance selection.
- Numeric values are converted only when finite; empty and invalid values remain empty strings. Date/time input values are preserved in backend-compatible native string forms.
- Dedicated legacy validators, custom masks, barcode input, and browser parity are still required before claiming full scalar renderer compatibility.


## Renderer migration boundary — 2026-11-25

The registry now exposes a tested list of implemented renderer types. Do not mark the remaining host-dependent families complete until their real host adapters are connected: FileUpload (TUS and file-token lifecycle), VoiceRecord (recorder plus TUS), Location (permission and map picker), Payment (partial-save, gateway, SignalR and validation), Captcha (provider verification), RecordsOtherForms (cross-form data query), RetailAudit (special serialization), Matrix_Dynamic, SkuCount (legacy non-dynamic mode), OpenPopUpSection and composite Group/Chart behavior. The correct next step is to supply those host contracts, not to register a renderer that only looks functional.


## Renderer parity — next implementation batch

The scalar renderer and the central validation boundary now share the same rules for Numeric, Point, Email, Mobile, Phone, NationalCode, custom masks, and Date. FileUpload answer validation also checks the archived count/size/extension settings and requires completed uploads with server-issued file IDs.

Remaining work should prioritize real host adapters, not placeholder renderers:

- Define and wire the TUS upload port with file-token handling, metadata, retry policy, progress, cancellation, and server response mapping before registering FileUpload.
- Wire VoiceRecord through the browser recorder and the existing server-side voice-record/TUS lifecycle; the canonical answer serializer already expects saved file IDs.
- Implement Captcha and Mobile/Email verification through the archived validation endpoints, preserving validation keys/GUIDs and expiration behavior.
- Implement Location with a host-provided map/geolocation selector; do not assume browser geolocation permission or a particular map library.
- Continue Matrix_Dynamic, RetailAudit, RecordsOtherForms, Payment, Chart, Group, and popup-section parity only after their source contracts and host services are mapped.
- Add browser E2E coverage for the renderer-to-runtime bridge, upload/verification lifecycles, and full legacy-vs-new submission payloads.

Do not add these platform-bound question types to SUPPORTED_QUESTION_RENDERER_TYPES until their host adapter and submission behavior are wired and tested.


## 2026-11-28 — file transfer implementation boundary

The archived FileUpload and VoiceRecord components share the same TUS endpoint,
metadata, token header, retry policy, resume behavior and response-header
mapping. A transport-independent FileUploadRuntime now owns the upload state
machine, immutable progress snapshots, retries, cancellation, stale callback
protection and required server file IDs. The adapter contract is documented in
docs/architecture/FILE-TRANSFER.md.

Next, implement the concrete host adapter with the existing tus-js-client
behavior (including the custom PATCH content type, previous-upload resume and
legacy no-retry status classification), then connect the file-token provider
and renderer UI. Keep FileUpload and VoiceRecord out of the supported renderer
registry until that integration is complete. The recorder itself and its
voice-record token acquisition must remain separate from the shared transfer
transport.


## 2026-11-28 — TUS and voice capture batch

The runtime now has a tus-js-client adapter port implementation and a browser
MediaRecorder capture engine. The adapter handles previous-upload resume,
legacy PATCH content type, retry status classification, progress and server
response headers. The voice engine handles microphone permission, format
selection, capture, duration, cancellation, stale async permission results and
track cleanup. A helper retains the archived recorded-voice filename.

Next work should be a single host-integration slice: locate/define the new
application composition root, supply the generated file-token DTOs and CDN
configuration, instantiate tus-js-client plus the legacy-compatible HTTP
stack, bridge FileUploadRuntime snapshots into the canonical answer state,
and connect BrowserVoiceRecorder output to the same upload runtime. Keep
FileUpload and VoiceRecord out of the renderer registry until that complete
path is covered by integration tests. Do not add the dependency or fabricate
token endpoints until the correct host contract is confirmed.


## File answer-state bridge

The TUS lifecycle and browser recorder now share a queue path. The new
file-upload-answer adapter converts a completed upload into the canonical
FileUpload/VoiceRecord answer array expected by the existing submission
serializer and saved-answer restorer, including safe numeric file IDs and
immutable append/replace/remove operations.

Next, connect these helpers to the Angular host's active answer instance and
renderer lifecycle. Do not mark FileUpload/VoiceRecord supported until the
host has a real TUS dependency/HTTP stack/token source, dispatches upload
completion into the canonical answer store, handles delete/retry UI, and has
integration coverage for final submission and restore.


## 2026-11-28 — survey-aware upload coordination

The coordinator now reads per-question file tokens and upload settings from the detached SurveyDefinition source snapshot, assigns tokens by selected-file slot, applies archived extension/size/max-count checks, and merges completed uploads into canonical file answers by server fileUniqueId. It also exposes the voice token path through the shared upload runtime.

Next, implement the Angular host composition and lifecycle: supply the real tus-js-client constructor/custom HTTP stack and configured remote CDN URL, instantiate the coordinator for the active survey, connect file selection/progress/retry/cancel/delete to the canonical answer-instance command bridge, and gate final submission on all required uploads being terminal and valid. Do not register the renderers until that integration and final payload/restore parity are tested.


## 2026-11-28 — upload submission safety

The survey-aware upload coordinator now exposes submission issues and a fail-closed readiness assertion. Pending, retrying, failed and cancelled selections cannot silently pass into final submission. The voice path also exposes the exact legacy voter-detail fileId/fileUniqueId pair, requiring one successful upload and a safe numeric file ID.

Next, wire this gate and metadata into the Angular submission coordinator, then connect the file picker/progress/retry/delete UI. Do not mark renderer parity complete until actual TUS integration and saved-voter restore are verified end-to-end.


## 2026-11-28 — Angular file-transfer host integration

The Angular host now has a concrete composition root, with an explicit TUS constructor provider and the archived CDN endpoint. VoteComponent can create a per-survey coordinator, commit completed file answers through the canonical answer bridge, expose lifecycle methods, and attach voice-upload metadata to final submission. The submission coordinator invokes a readiness hook before sending. File uploads are scoped to their repeated-section answer instance.

Next:
1. Install `tus-js-client` in the consuming application and register `provideSurveyFileTransfer(Upload)` in root providers.
2. Implement dedicated FileUpload and VoiceRecord renderer components using these host methods and display immutable progress snapshots.
3. Add real browser tests against the configured CDN, including resume, cancellation, server error bodies, upload metadata, answer restore, and final submission.
4. Verify voice recording MIME compatibility and legacy playback in supported browsers.


## Current execution priorities — 2026-11-28

1. Validate the full runtime profile benchmark in CI and review cold compile, warm evaluation, full projector, one-answer propagation and heap output for small/medium/large synthetic surveys.
2. Inspect the generated source-map attribution artifact and identify candidate modules contributing to the 430.24 kB initial chunk. Confirm every optimization against a production bundle-size comparison.
3. Establish real Chromium E2E for session startup/restore, SectionLoop navigation, renderer-to-session synchronization and Dynamic Data request races. The existing Vitest tests use deterministic fakes and are not browser E2E.
4. Run FileUpload/VoiceRecord against a dedicated staging poll with valid file tokens and a configured CDN; verify resume, cancellation, retry/error handling, canonical answer/restore, microphone permissions and playback.
5. Continue Payment and remaining renderer/API parity only against verified legacy contracts. Keep incremental evaluation out of production until full projector parity is proven.


## Updated priorities after the first benchmark run — 2026-11-28

1. Trace the actual import chain for Luxon and Angular Core debug-node code in the 430.33 kB unnamed initial chunk. Use one isolated change per run and compare raw/transfer sizes; do not remove sanitizer or formula parser behavior without compatibility tests.
2. Repeat the small/medium/large benchmark on the same runner and add at least one anonymized fixture derived from a representative real survey shape. Compare the full projector with any future optimized path only after complete output parity.
3. Add a real Chromium runner for session startup/restore, SectionLoop navigation, renderer synchronization and Dynamic Data races. Current Vitest tests remain fake-transport/unit integration, not browser E2E.
4. Run live FileUpload/VoiceRecord staging tests with valid tokens, dedicated poll/CDN, microphone permission and playback checks.


## Active implementation direction — 2026-11-28

The performance/bundle attribution and browser/CDN verification batch is intentionally deferred by the project owner. Do not spend the next implementation cycle on Luxon/Angular debug-node import tracing, Chromium E2E setup, or live CDN/microphone verification.

Continue the renderer/API compatibility phase instead:

1. Complete Payment renderer integration around the new PaymentQuestionRuntime: concrete host HTTP endpoints, SignalR lifecycle, partial-save integration through the canonical submission coordinator, reactive amount updates, answer bridge, timer cleanup and accessible UI. Keep it out of the supported renderer list until its host contract is fully wired.
2. Port Matrix_Dynamic and remaining source-verified question families using their archived templates and exact answer serialization contracts. Do not replace the legacy model with invented generic shapes.
3. Complete API-001/003/004/005/006: RetailAudit final-save conversion, nested restore fixtures, temporary/full/partial-payment orchestration and complete golden submission payload round trips.
4. Finish SESSION-002 formula parser/function and scope parity using archived expressions as fixtures. Keep the full evaluator as production oracle until complete projector differential parity is demonstrated.
5. Update TASKS.md and CURRENT-STATUS.md with each verified milestone. Do not mark host-dependent renderer support based only on a pure runtime abstraction.
