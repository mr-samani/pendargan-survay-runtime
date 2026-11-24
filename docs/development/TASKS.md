# Task board

Update this file in every milestone commit. A task is Done only when its acceptance criteria and tests pass.

## Phase 0 — discovery

- [ ] **DISC-001** Confirm source completeness.
  - Owner confirmed public visibility is intentional. Production source completeness still needs confirmation.
- [ ] **DISC-002** Inventory all question types and their production renderers.
  - Acceptance: each API enum ID maps to implementation, unsupported status, or deprecated status with evidence.
- [ ] **DISC-003** Trace all answer mutation and submission paths.
  - Acceptance: anonymized fixtures and expected serialized payloads exist for each supported type.
- [ ] **DISC-004** Inventory expression targets/actions and formula/global-variable initialization.
  - Acceptance: precedence, dependencies, and side effects are documented with tests.
- [ ] **DISC-005** Inventory sections, loops, navigation, validation, quota, and hidden-answer policy.
  - Acceptance: behavior matrix contains verified examples.
- [ ] **PERF-001** Establish reproducible performance and bundle baselines.
  - Acceptance: cold/warm expression timings, update propagation timings, memory, initial bundle and lazy chunks recorded.
  - Partial: initial/lazy production bundle snapshot is recorded in `docs/ai/CURRENT-STATUS.md`; runtime and memory measurements remain open.

## Phase 1 — definition compiler

- [x] **CORE-001** Define immutable domain types.
- [x] **CORE-002** Build DTO-to-domain adapter with validation/diagnostics.
- [x] **CORE-003** Compile expression sources and dependency metadata.

## Phase 2 — evaluation

- [x] **GRAPH-001** Build typed dependency graph and cycle diagnostics.
- [x] **GRAPH-002** Implement full-recalculation reference evaluator.
  - Evaluates formulas in graph order, calculates global variables, returns action proposals, and restores formula-engine variable values.
  - Unit and real FormulaEngineService integration tests pass.
- [ ] **GRAPH-003** Implement dirty-node incremental evaluator.
- [ ] **GRAPH-004** Add differential/property-based tests.

## Phase 3 — runtime state and flow

- [ ] **STATE-001** Define answer state and action commands.
- [ ] **VIS-001** Implement option/question/section visibility and aggregation.
- [ ] **FLOW-001** Implement normal navigation and one-question-per-page mode.
- [ ] **FLOW-002** Implement repeated section runtime instances and loop navigation.
- [ ] **VALID-001** Implement required/min/max and type-specific validation projection.

## Phase 4 — renderers and integration

- [x] **RENDER-001** Replace weak renderer map with typed lazy registry.
- [x] **RENDER-002** Add in-flight loader cache and parallel required-type loading.
- [ ] **RENDER-003** Migrate supported renderers with parity tests.
- [ ] **API-001** Implement legacy answer/submission adapter.
- [ ] **PERF-002** Compare bundle and runtime metrics against baseline.

## Phase 5 — rollout

- [ ] **E2E-001** Run full survey fixture suite in browser.
- [ ] **A11Y-001** Validate keyboard, screen reader, focus, contrast, and RTL/LTR.
- [ ] **ROLLOUT-001** Define feature flag and rollback strategy.
