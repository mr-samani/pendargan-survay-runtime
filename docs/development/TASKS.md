# Task board
Update this file in every milestone commit. A task is Done only when its stated scope and tests pass. Partial work is explicitly recorded below; host-dependent features must not be marked supported before end-to-end integration and parity tests pass.

## Phase 0 — discovery

- [x] **DISC-001** Confirm source strategy; original source ZIP is a behavior reference and is not copied into the rewrite.
- [ ] **DISC-002** Inventory all question types and their original renderers.
- [ ] **DISC-003** Trace complete answer mutation and submission paths; capture golden serialized payloads.
- [x] **DISC-004** Identify legacy SectionLoop expression target and section target-key mapping.
- [x] **DISC-005** Verify section-loop counter, navigation, repeated answer snapshot, and variable-snapshot behavior.
- [x] **DISC-006** Extract per-question serialization behavior from the original ConverterDataService.
- [ ] **PERF-001** Establish runtime and memory baselines.
  - Partial: CI run 46128065393 passed the versioned small/medium/large benchmark. It records cold compile, warm full evaluation, full projector and one-answer propagation p50/p95/p99 plus noisy retained-heap deltas. The first sample is documented in BENCHMARKS.md; browser timings, repeated runs and representative production fixtures remain open.

## Phase 1 — definition compiler

- [x] **CORE-001** Define immutable domain types.
- [x] **CORE-002** Build DTO-to-domain adapter with validation/diagnostics.
- [x] **CORE-003** Compile expression sources and dependency metadata.

## Phase 2 — evaluation

- [x] **GRAPH-001** Build typed dependency graph and cycle diagnostics.
- [x] **GRAPH-002** Implement full-recalculation reference evaluator.
- [x] **GRAPH-003** Implement dirty-node incremental evaluator.
- [x] **GRAPH-004** Add seeded differential tests; 100 updates compared against the full oracle.

## Phase 3 — runtime state and flow

- [x] **STATE-001** Define immutable answer state and atomic input commands.
- [x] **STATE-002** Define action commands for InsideForm Answer Select/UnSelect.
- [x] **VIS-001** Implement pure visibility projection for InsideForm Question/Answer Show/Hide.
- [x] **FLOW-001** Implement section-per-page and question-per-page projections.
- [x] **FLOW-002** Implement bounded SectionLoop runtime and loop-aware flow pages.
- [x] **VALID-001** Implement shared scalar validation and FileUpload answer validation.
  - Implemented rules and exact boundaries are documented in CURRENT-STATUS.md; upload answer validation does not prove the browser upload lifecycle is complete.

## Phase 4 — runtime, renderers and integration

### Runtime and formula compatibility

- [x] **SESSION-001** Implement session controller and concrete projector.
  - Session owns page navigation and atomic answer batches. Concrete projector evaluates formulas through an injected scope adapter, applies supported Select/UnSelect actions to a fixed point, and builds visibility, validation, and flow projections.
  - Safety: bounded pass count, answer-state cycle detection, evaluator exception handling, and stale-projection rejection. Backward navigation reactivates the correct loop iteration and recomputes its projection.
- [ ] **SESSION-002** Complete legacy formula scope aliases and parser semantics.
  - Partial: immutable namespaced scope factory, selected-option metadata, active loop variables, flat legacy token adapter, global-variable evaluation/effect planning and question-walk compatibility are implemented. Production evaluator parity, parser function registration, complete alias/property-access/missing-value semantics and real payload verification remain open.
- [x] **SESSION-003** Implement runtime session coordinator, renderer event bus/adapter, and host-side session bridge.
  - Integration remains partial: VoteComponent lifecycle must invoke the bridge after answer hydration and synchronize accepted session transitions with VoteService.
- [ ] **SESSION-004** Complete live Angular session lifecycle integration, including restore-before-subscribe ordering, active-instance synchronization and repeated-loop UI tests.

### Renderer registry and UI parity

- [x] **RENDER-001** Replace weak renderer map with typed lazy registry.
- [x] **RENDER-002** Add in-flight loader cache and parallel required-type loading.
- [x] **RENDER-003a** Add canonical event publishing for UniqueSelect, MultiSelect and shared ScalarAnswer renderer.
  - Scalar coverage: ShortText, LongText, Numeric, Date, Time, Email, Phone, Mobile, NationalCode and PostalCode. Dedicated legacy masks/validators, browser parity and other renderer families remain open.
- [ ] **RENDER-003** Migrate the remaining supported renderer families with parity tests.
- [x] **RENDER-004a** Connect DynamicAnswer and SkuCount_Dynamic renderers to reactive runtime effects and the dynamic-data request lifecycle.
  - Live VoteComponent registration, instance-scoped refresh requests, cancellation and authenticated Angular transport are implemented; live API/browser parity remains part of E2E-001.
- [ ] **RENDER-004b** Complete Payment host integration and parity; keep it out of the generic supported-renderer registry until all gates pass.
  - Partial: PaymentQuestionRuntime, the four archived HTTP endpoints, ConfirmPayment=8, ABP error handling, ordered partial save, prior-question locks, responsive host UI, timer, synchronous popup reservation/fallback link, manual refresh/cancel, and canonical server-GUID answer bridge are connected. The charged amount is preserved in the canonical answer and serialized payload. SignalR now has a concrete `@microsoft/signalr@10.0.11` provider with cookie credentials, optional access-token factory, initial-start retries, automatic reconnect, lifecycle callbacks, deduplicated subscriptions and teardown. Notifications reject empty correlation IDs and pass through a bounded, concurrency-safe event gate; failed consumers are retryable. Live gateway and browser parity remain open. Latest CI [46139872529](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46139872529): production build and source-map attribution artifact upload succeeded; 66 test files / 450 tests / 1 skipped. The 1.005 MB hard-build allowance is temporary; the 500 kB warning remains active. See PAYMENT-QUESTION.md.
- [ ] **RENDER-005** Implement remaining source-verified renderer families (including Matrix_Dynamic, RetailAudit, RecordsOtherForms, Chart, Group and popup-section behavior) only after host/service contracts are mapped. RetailAudit's V2 autocomplete registration, expression-filter request path, duplicate-selection policy, stable per-row identity, immutable per-product child-answer/variable snapshots and required/mandatory-completion validation are implemented in the runtime controller. The Angular product picker and child-question editor UI remain open. CI verified the new registration/request contract and compile-time separation from the existing DynamicAnswer/SKU renderer controller.
  - Partial: Matrix_Dynamic now has a source-verified row-major layout projector, responsive Angular table renderer, explicit Matrix_Radio/Matrix_Checkbox/Matrix_MultiNumeric/Matrix_MultiShortText cell renderers, row/column visibility projection and archived pixel column sizing. Ten deterministic tests pass in CI [46131027929](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46131027929). Matrix_Dynamic now reads reactive runtime title/description overrides and VoteService exposes an ID-based update bridge; formula-interpolation producer wiring, legacy validation parity, formula-producer wiring and browser fixtures remain open; nested Matrix_Dynamic descendants now have a RetailAudit restore-to-submit fixture proving the container is flattened and leaf-cell answers retain the product record ID; see MATRIX-DYNAMIC.md.
- [ ] **RENDER-006** Add browser-level renderer parity tests; do not register host-dependent placeholders as supported.

### File and voice transfer

- [x] **UPLOAD-001** Define transport-independent FileUploadRuntime state machine (progress snapshots, retries, cancellation, stale-callback protection and required server file IDs).
- [x] **UPLOAD-002** Implement tus-js-client adapter behavior (resume, legacy PATCH content type, retry classification, progress and response-header mapping).
- [x] **UPLOAD-003** Implement browser MediaRecorder capture engine (permission, format selection, duration, cancellation and track cleanup).
- [x] **UPLOAD-004** Map completed FileUpload/VoiceRecord transfers into canonical answer arrays and legacy voice metadata.
- [x] **UPLOAD-005** Add survey-aware upload coordinator (per-question/per-selected-file tokens, legacy constraints, answer merge and voice token path).
- [x] **UPLOAD-006** Add fail-closed submission readiness checks for pending/failed/cancelled uploads and required voice metadata.
- [x] **UPLOAD-007** Add Angular host composition root, per-survey coordinator, canonical answer bridge, lifecycle methods and submission readiness hook; scope uploads to repeated-section answer instances.
- [x] **UPLOAD-008** Add and wire tus-js-client with the configured TUS transport, CDN endpoint, token/metadata handling and host composition.
  - tus-js-client 4.3.1 is installed and lazy-loaded; the host uses the archived FileStorage_CDN route.
- [x] **UPLOAD-009** Implement FileUpload host UI: file picker, immutable progress, retry, cancel, remove and validation feedback.
- [x] **UPLOAD-010** Implement VoiceRecord host UI and connect browser recording output to the shared upload coordinator.
- [ ] **UPLOAD-011** Run browser integration tests against the configured live upload service: resume, cancellation, retry/error bodies, metadata, token refresh, repeated sections, restore and final submission.
- [ ] **UPLOAD-012** Verify recorded MIME/codec playback compatibility, visual audio preview and supported hybrid bridges (Xamarin/KBrowser).
  - Host transport and controls are implemented, but do not claim production upload/voice parity until live CDN/browser tests and playback/device checks (UPLOAD-011/012) pass.

### API, persistence and submission

- [ ] **API-001** Complete legacy answer/submission adapter.
  - Partial: verified question serializer families, repeated-section envelope, variablesLastValue merge, top-level CreateVoterWithDetailsDto metadata builder, Matrix cell-answer serialization, and source-verified RetailAudit final/temporary/partial row expansion are implemented. RetailAudit required child validation, recursive Matrix/Group descendant restoration at arbitrary depth, recursive flatten-on-submit, selected-choice answer handling, restore-to-submit coverage and exact JSON payload assertions are wired. Remaining: broader complete golden payloads, generated DTO schema parity and full save orchestration.
- [x] **API-002** Build top-level CreateVoterWithDetailsDto metadata projection.
  - Local compatibility extensions now preserve legacy fileId and dynamicDataRecordId string/number. Verify these extensions against backend OpenAPI before regenerating service proxies.
- [ ] **API-003** Complete saved-answer restore from GetVoterFullDetail/temporary-save DTOs.
  - Partial: supported question families, repeated loop instances, one-based backend loop indexes, popup filled state, elapsedTime, RetailAudit child reconstruction (including arbitrarily nested Matrix/Group descendants with cycle protection), three-level restore-to-submit RetailAudit fixture, and VoiceRecord file-detail hydration are implemented. Broader nested-child golden fixtures remain open.
- [ ] **API-004** Complete temporary/full/partial-payment save orchestration. RetailAudit final/temporary/partial row conversion and the Payment rule that every preceding question must be explicitly valid are implemented and unit-tested; host-level save workflow and backend round-trip verification remain open. Payment partial-save guard tests now cover explicitly valid predecessors, invalid predecessors, missing validation entries and ambiguous payment IDs.
- [ ] **API-005** Verify quotas, EndForm/SubmitForm, post-submit actions, dynamic-answer filters and submission response handling against the archived application and backend contracts.
- [ ] **API-006** Add golden tests for complete final, temporary and partial-payment payloads, plus restore-to-resubmit round trips. A duplicate-product RetailAudit fixture now verifies that two rows with the same catalog record ID serialize as separate repeated sections with independent child answers and per-row variables; full payload goldens remain open; nested Matrix_Dynamic descendants are also covered through RetailAudit restore-to-submit.

### Performance, quality and rollout

- [ ] **PERF-002** Compare bundle and runtime metrics against a recorded baseline.
  - The initial bundle is currently about 502.1 kB; the 500 kB warning remains active. The hard production-build ceiling is temporarily 1.005 MB (5 kB above the previous 1 MB cap) so CI can complete while the pre-existing and SignalR-related initial-bundle delta is tracked under PERF-002. Do not mark bundle optimization complete from this threshold adjustment.
  - CI run 46128065393 successfully generated and uploaded the source-map attribution report. The initial bundle is 966.00 kB raw / 246.15 kB estimated transfer; the 430.33 kB unnamed chunk has candidate source associations with Angular Core debug-node, Luxon and ngx-exp-parser. Import-edge tracing and measured optimization remain open; source-content byte counts are not exact retained bytes.
- [x] **PERF-003** Index immutable question/option aliases for Select/UnSelect action resolution.
  - Definition-scoped WeakMap indexes preserve first-match behavior for duplicate aliases. CI passed production build and 60 test files / 374 tests (run 46127175859). Focused synthetic benchmark: 2,000 questions / 8,000 options / 1,500 actions; p50 16.17 ms linear vs 1.40 ms indexed (11.55x median ratio). This is not a whole-runtime speedup.
- [x] **PERF-004** Reuse immutable definition indexes in visibility target resolution and section membership grouping.
  - Question/option first-match semantics and multi-section alias membership are regression-tested; CI passed production build and 60 test files / 377 tests (run 46127388932).
- [ ] **E2E-001** Run full survey fixture suite in a real browser, including new survey, Edit restore, temporary restore/cancel, repeated SectionLoop navigation/backtracking, dynamic-data isolation and final/partial/temporary submit. Existing fake-transport Vitest coverage is not browser E2E; requirements and environment gates are in BROWSER-E2E.md.
- [ ] **A11Y-001** Validate keyboard, screen reader, focus, contrast and RTL/LTR.
- [ ] **ROLLOUT-001** Define feature flag and rollback strategy.

## Execution order — next milestones

The project owner explicitly deferred bundle import-chain tracing, Chromium E2E setup and live CDN/Voice verification. Keep PERF-002, E2E-001 and UPLOAD-011/012 open; do not treat them as completed.

1. Complete Payment UI and SignalR integration around PaymentQuestionRuntime, including timer/popup behavior and canonical payment-answer synchronization (RENDER-004b).
2. Finish Matrix_Dynamic parity gaps and port the remaining source-verified renderer families (RENDER-003/005).
3. Complete RetailAudit and nested saved-answer restore, temporary/full/partial-payment orchestration and golden payload round trips (API-001/003/004/005/006).
4. Finish legacy formula parser/function and scope parity, retaining the full evaluator as the production oracle (SESSION-002).
5. Return to bundle analysis, browser/CDN/device verification, accessibility and guarded rollout when the owner reopens those deferred tracks (PERF-001/002, UPLOAD-011/012, E2E-001, A11Y-001, ROLLOUT-001).

For implementation details and latest evidence, see ../ai/CURRENT-STATUS.md and ../ai/NEXT-STEPS.md. Update this board in the same commit as every milestone; never mark work Done solely because an abstraction or placeholder exists.
