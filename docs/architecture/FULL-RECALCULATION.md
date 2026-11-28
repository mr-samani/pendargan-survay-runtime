# Full-recalculation evaluator

## Purpose

The full evaluator is the correctness-first reference implementation. It evaluates global-variable formulas and action expressions in dependency order against one supplied answer-state snapshot.

It returns:
- formula execution results and errors;
- computed global-variable scalar values;
- proposed actions with their original target/action metadata and condition result;
- diagnostics.

## Evaluation rules

1. A graph with a cycle is rejected before evaluation.
2. Global-variable aliases are temporarily isolated in the supplied formula-engine instance. Existing values are restored in a `finally` block after the full evaluation.
3. Formulas are visited in the graph's stable topological order.
4. Inactive or uncompiled formulas are skipped.
5. Global-variable formulas must return a scalar (string, number, boolean or null). A failed/unavailable global variable blocks formulas that depend on it.
6. Action expressions produce proposals only. No action is applied and the answer scope is not mutated by this evaluator.
7. The result is detached and immutable.

## Why actions are proposals

The legacy client currently groups Show/Hide/Select/UnSelect expressions, but its behavior is incomplete and performs option mutation from inside a computed signal. The new evaluator must not repeat that pattern.

Conflicting actions, visibility aggregation, required-state changes, submit/end-form behavior, quota semantics and target-specific effects will be handled by a later action/visibility transaction after their production semantics are verified.

## Scope and limitations

The caller supplies the answer snapshot as `scope`. Legacy entity references such as `@Q...` resolve through that scope in the installed `ngx-exp-parser` engine. Global variables are injected into the engine only for the duration of this synchronous full evaluation and restored afterward.

This evaluator is intentionally synchronous. Async dynamic-data, file, payment and external-action effects belong to separate effect handlers and must not run inside formula evaluation.
