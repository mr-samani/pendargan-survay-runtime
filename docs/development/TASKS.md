# Task board

Update this file in every milestone commit. A task is Done only when its stated scope and tests pass.

## Phase 0 — discovery

- [x] **DISC-001** Confirm source strategy; original source ZIP is a behavior reference and is not copied into the rewrite.
- [ ] **DISC-002** Inventory all question types and their original renderers.
- [ ] **DISC-003** Trace complete answer mutation and submission paths; capture golden serialized payloads.
- [x] **DISC-004** Identify legacy SectionLoop expression target and section target-key mapping.
- [x] **DISC-005** Verify section-loop counter, navigation, repeated answer snapshot, and variable-snapshot behavior.
- [x] **DISC-006** Extract per-question serialization behavior from the original ConverterDataService.
- [ ] **PERF-001** Establish runtime and memory baselines.
  - Partial: initial/lazy production bundle snapshot is recorded in CURRENT-STATUS.md.

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
- [x] **VALID-001** Implement baseline required-answer and Point range validation projection.
  - Other type-specific constraints remain open until verified against the original source.

## Phase 4 — renderers and integration

- [x] **RENDER-001** Replace weak renderer map with typed lazy registry.
- [x] **RENDER-002** Add in-flight loader cache and parallel required-type loading.
- [ ] **RENDER-003** Migrate supported renderers with parity tests.
- [ ] **API-001** Implement full legacy answer/submission adapter.
  - Partial: verified question serializer families, repeated-section envelope, variablesLastValue merge, and top-level CreateVoterWithDetailsDto builder are implemented. Remaining: RetailAudit final-submit conversion, schema parity, full save orchestration, and complete golden payloads.
- [x] **API-002** Build top-level CreateVoterWithDetailsDto metadata projection.
  - Current generated file DTO omits legacy fileId; tracked as a contract gap.
- [ ] **API-003** Implement saved-answer restore from GetVoterFullDetail/temporary-save DTOs.
  - Partial: supported question families, repeated loop instances, one-based backend loop indexes, popup filled state, elapsedTime and RetailAudit child reconstruction are implemented. VoiceRecord metadata mapping and broader nested-child golden fixtures remain open.
- [x] **SESSION-001** Implement session controller and concrete projector.
  - Session owns page navigation and atomic answer batches. Concrete projector evaluates formulas through an injected scope adapter, applies supported Select/UnSelect actions to a fixed point, and builds visibility, validation, and flow projections.
  - Safety: bounded pass count, answer-state cycle detection, evaluator exception handling, and stale-projection rejection. Formula scope alias parity remains a separate task.
- [ ] **SESSION-002** Implement and verify legacy formula scope factory.
- [ ] **PERF-002** Compare bundle and runtime metrics against baseline.

## Phase 5 — rollout

- [ ] **E2E-001** Run full survey fixture suite in browser.
- [ ] **A11Y-001** Validate keyboard, screen reader, focus, contrast, and RTL/LTR.
- [ ] **ROLLOUT-001** Define feature flag and rollback strategy.
