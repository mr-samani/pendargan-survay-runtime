# Expression compilation

## Boundary

Expression compilation consumes a validated immutable survey definition and a caller-supplied `FormulaEngineService` instance. It registers formula source with the expression engine but does not evaluate expressions or execute actions.

The caller controls the engine instance and therefore controls the lifetime/scope of registered formula IDs. Formula IDs are namespaced by survey ID and source kind to prevent collisions between question actions and global variables.

## What is compiled

- Every non-empty expression record, including inactive records, so source and diagnostics remain available.
- Every non-empty global-variable expression.
- Expression metadata remains attached: action, target, target key, question reference and form-expression scope.
- Dependency metadata is copied from the expression engine's parsed formula definition.
- Volatility metadata is preserved for explicit host scheduling.

## Diagnostics

- Empty active source: error.
- Empty inactive source: retained but not registered.
- Invalid active source: error.
- Invalid inactive source: warning.
- A structurally invalid definition is not registered with the formula engine.

## Runtime boundary

Registration is parsing/compilation only. It does not execute Show/Hide/Select/UnSelect or any other action. Runtime evaluation and action application will be implemented separately as deterministic transactions.

The returned metadata is detached and frozen. The formula engine remains the owner of its registered programs and dependency graph.
