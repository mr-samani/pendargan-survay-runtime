# Task board

Update this file in every milestone commit. A task is Done only when its stated scope and tests pass.

## Phase 0 — discovery

- [x] **DISC-001** Confirm source strategy; original source ZIP is retained as a behavior reference.
- [ ] **DISC-002** Inventory all question types and their original renderers.
- [ ] **DISC-003** Trace complete answer mutation and submission paths; capture golden serialized payloads.
- [x] **DISC-004** Identify legacy SectionLoop expression target and section target-key mapping.
- [x] **DISC-005** Verify core section-loop counter, navigation, repeated answer snapshot, and variable-snapshot behavior.
- [x] **DISC-006** Extract per-question serialization behavior from the original ConverterDataService.
- [ ] **PERF-001** Establish runtime and memory baselines.
  - Partial: initial/lazy production bundle snapshot recorded in CURRENT-STATUS.md.

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
- [x] **VIS-001** Implement pure option/question/section visibility for InsideForm Question/Answer Show/Hide.
- [x] **FLOW-001** Implement section-per-page and one-question-per-page projections with previous/next navigation.
- [ ] **FLOW-002** Complete repeated-section runtime integration.
  - Partial: SectionLoop expression detection/result bridge, iteration lifecycle, isolated answer namespaces, backward re-entry/reuse, variable snapshots, filled tracking, bounded iteration count, and loop-aware flow pages are implemented. A runtime controller must still connect actual user navigation and active answer instance.
- [x] **VALID-001** Implement baseline required-answer and Point range validation projection.
  - Other type-specific constraints remain open until verified against the original source.

## Phase 4 — renderers and integration

- [x] **RENDER-001** Replace weak renderer map with typed lazy registry.
- [x] **RENDER-002** Add in-flight loader cache and parallel required-type loading.
- [ ] **RENDER-003** Migrate supported renderers with parity tests.
- [ ] **API-001** Implement full legacy answer/submission adapter.
  - Partial: verified per-question serialization families, repeated-section envelope, variablesLastValue merge, and top-level CreateVoterWithDetailsDto builder are implemented. Remaining: restore/load adapter, RetailAudit conversion, schema parity, runtime values, and complete golden API fixtures.
- [x] **API-002** Build top-level CreateVoterWithDetailsDto metadata projection, including partial-payment metadata and voice-record file references.
  - Current generated file DTO omits legacy fileId; tracked as a contract gap.
- [ ] **API-003** Implement saved-answer restore from GetVoterFullDetail/temporary-save DTOs into immutable answer state.
  - Partial: per-question and section-level restore cover choice/priority, scalar, FileUpload, DynamicAnswer, SKU, Captcha and Payment; one-based loop traversal, isolated answer instances, popup filled state and temporary elapsedTime are implemented. RetailAudit item/child reconstruction is implemented with first-pass formValid parity. Remaining: broader nested-child golden fixtures, VoiceRecord metadata path, and any additional variable restore contract.
- [ ] **PERF-002** Compare bundle and runtime metrics against baseline.

## Phase 5 — rollout

- [ ] **E2E-001** Run full survey fixture suite in browser.
- [ ] **A11Y-001** Validate keyboard, screen reader, focus, contrast, and RTL/LTR.
- [ ] **ROLLOUT-001** Define feature flag and rollback strategy.
