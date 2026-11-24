# Next steps

The owner confirms the original production client was supplied separately as a ZIP and intentionally not committed to this clean rewrite repository. Use that archive as a reference when verifying legacy behavior; do not copy its architecture into the new runtime.

The definition compiler, formula graph/evaluators, answer store, visibility projection and first action transaction are implemented. Keep formula evaluation, visibility projection and answer mutation as separate layers.

## Remaining behavior to verify against the original source

1. All question types and their renderer behavior, including additional settings and custom validation.
2. Exact global-variable names, aliases, initialization order and volatile formula refresh behavior.
3. Every expression scope, target and action, including quota, section loops, form-level actions, post-submit actions and dynamic-answer filters.
4. Exact answer save/submit request payload, file handling, loop/partial indexes, and server response behavior.
5. Hidden-answer retention/clearing behavior.
6. Select/UnSelect conflict precedence. The new transaction groups same-type conditions with AND and rejects conflicting successful Select/UnSelect groups by default. Opt-in precedence policies are not claimed to match legacy behavior.

## Next milestone — validation projection

Implement validation as a pure projection over definition + answer snapshot + visibility:
- required and optional answers;
- empty-value semantics per question type;
- min/max selection/count rules;
- numeric bounds and decimal steps where the question type supports them;
- hidden/disabled question behavior only after its policy is verified;
- diagnostics tied to stable question/option IDs.

Use the original source to establish semantics first; do not infer them from DTO property names alone.

## Then — flow runtime

Build a flow model independent from Angular components:
- visible section ordering;
- visible question ordering;
- normal next/previous navigation;
- one-question-per-page projection;
- loop runtime instances after loop semantics and instance-scoped answer payloads are verified.

Keep navigation as a projection over runtime state; do not embed it in renderer components or computed template getters.

## Integration

- Migrate question types incrementally behind the typed lazy renderer registry.
- Implement exact legacy serialization and submission behavior from verified request fixtures.
- Add browser parity tests and compare runtime/memory metrics against the baseline.
