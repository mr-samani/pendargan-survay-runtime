# Architecture decision records

## ADR-001 — Keep the legacy runtime as a compatibility oracle

**Status:** Accepted  
**Decision:** Build the new runtime alongside the current implementation. Do not replace or delete the old implementation until representative survey fixtures prove parity.  
**Reason:** The checked-in source does not establish every production behavior, especially section loops, hidden-answer policy, and submission semantics.

## ADR-002 — Explicit lazy renderer registry

**Status:** Accepted  
**Decision:** Use a finite registry from trusted question type IDs to dynamic import loader functions. Never accept module paths from the API.  
**Reason:** It gives predictable bundler split points, safe type resolution, testable unsupported-type behavior, and a path to loading only the types required by a survey.

## ADR-003 — Separate definition, runtime state, and presentation

**Status:** Accepted  
**Decision:** Definition data is immutable; answers/visibility/flow are runtime state; Angular components render state and dispatch commands.  
**Reason:** Prevents domain logic from being coupled to component lifecycle and makes deterministic unit tests possible.

## ADR-004 — Full recomputation remains the correctness oracle

**Status:** Accepted  
**Decision:** Keep a simple full evaluator in tests while introducing incremental dirty-node evaluation.  
**Reason:** Incremental algorithms are easy to make subtly incorrect when dependencies, loops, and action precedence interact.

## ADR-005 — No performance claims without a baseline

**Status:** Accepted  
**Decision:** Measure cold compile, warm eval, update propagation, memory, initial JS, and lazy chunk transfer separately.  
**Reason:** A bytecode interpreter or dynamic imports alone do not establish an end-to-end speed or bundle-size improvement.
