# Incremental evaluator

## State

`SurveyIncrementalEvaluator` owns the last successful full/incremental snapshot for one survey runtime instance:

- formula results by formula ID;
- global-variable values and availability;
- proposed actions by expression ID;
- per-formula runtime diagnostics;
- the compiled graph and adjacency indexes.

Call `initialize()` once. It delegates to the full-recalculation oracle and seeds the caches. Call `update(changedNodeIds, scope)` after applying a batch of input changes to the supplied answer snapshot.

## Dirty propagation

1. Changed question/option/scope nodes seed a graph walk.
2. Only reachable formula nodes become dirty.
3. Dirty formulas are recomputed in the graph's stable topological order.
4. When a global-variable formula succeeds, compare its new value with the cached value using `Object.is`.
5. Propagate from that global-variable output node only when its value or availability changes.
6. If the value is unchanged, downstream formulas are not evaluated.
7. Expression formulas refresh their proposed action but do not mutate answers.

Failed or unavailable global variables block dependent formulas. The evaluator never lets a previous survey's variable value leak into a current calculation; aliases are temporarily populated from this runtime's cache and restored in a `finally` block.

## API contract

Changed node IDs use graph IDs, for example:
- `question:{definitionQuestionId}`
- `option:{definitionOptionId}`
- `scope:{path}`

Pass all changed IDs for one user action together. The scope object must already contain the new values. Unknown IDs produce warnings and do not discard the last snapshot.

## Correctness strategy

The full evaluator remains the oracle. Differential tests compare full and incremental formula values, global-variable values, and action proposals after the same input update. The incremental evaluator must not become the only implementation until randomized action-sequence tests establish parity.

## Runtime compatibility requirements

- Dynamic-answer filters are text templates, not executable boolean formulas. The incremental snapshot retains the templates from initialization and never sends them to the expression engine.
- Action conditions must preserve the full evaluator's strict boolean contract: only the boolean value `true` activates an action. Other values remain false and produce the same warning diagnostic.
- Global-variable aliases must match the full evaluator, including ID, source ID, unique ID per form, display title, and lowercase display title. The engine's prior alias values are restored after each update.

## Current limitations

- The graph models input-to-formula and formula-to-global-variable/action dependencies. Action outputs do not feed back into answer state.
- No action conflict resolution or visibility transaction is included.
- The evaluator is synchronous and assumes one non-reentrant evaluation at a time per supplied formula-engine instance.
- It is not yet wired into `ConcreteSurveyRuntimeProjector`. That projector currently receives no explicit changed-node set, and its formula scope depends on the active answer-instance/SectionLoop context. Reusing incremental state without deriving answer diffs and invalidating on instance, loop-variable, definition, and runtime-effect changes would risk stale formula results. Keep the full evaluator on the production projector until those invalidation inputs are explicit.
