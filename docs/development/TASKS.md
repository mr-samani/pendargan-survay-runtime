# Task board

Update this file in every milestone commit. A task is Done only when its stated scope and tests pass.

## Phase 0 — discovery

- [ ] **DISC-001** Confirm source completeness and production fixtures.
- [ ] **DISC-002** Inventory all question types and their production renderers.
- [ ] **DISC-003** Trace all answer mutation and submission paths; capture expected serialized payloads.
- [ ] **DISC-004** Inventory expression targets/actions and global-variable initialization.
- [ ] **DISC-005** Inventory sections, loops, navigation, validation, quota, and hidden-answer policy.
- [ ] **PERF-001** Establish runtime and memory baselines.
  - Partial: initial/lazy production bundle snapshot recorded in `docs/ai/CURRENT-STATUS.md`.

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
- [x] **STATE-002** Define a separate action-command model for InsideForm Answer Select/UnSelect.
  - Conflicts reject by default; explicit select-wins/unselect-wins policies are available. No legacy precedence is assumed.
- [x] **VIS-001** Implement pure option/question/section visibility for InsideForm Question/Answer Show/Hide.
  - Tri-state failed-condition handling and legacy AND aggregation covered by tests.
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
