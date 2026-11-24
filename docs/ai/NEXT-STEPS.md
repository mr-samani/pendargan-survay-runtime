# Next steps

The owner confirms the original production client was supplied separately as a ZIP and intentionally not committed to this clean rewrite repository. Use that archive as a behavior reference; do not copy its architecture into the new runtime.

The definition compiler, formula graph/evaluators, answer store, visibility projection, Select/UnSelect transaction, baseline validator, and non-loop flow projection are implemented. Keep formula evaluation, visibility, validation, flow, and answer mutation as separate layers.

## Remaining behavior to verify against the original source

1. All question types and their renderer behavior, including additional settings and custom validation.
2. Exact global-variable names, aliases, initialization order and volatile formula refresh behavior.
3. Every expression scope, target and action, including quota, section loops, form-level actions, post-submit actions and dynamic-answer filters.
4. Exact answer save/submit request payload, file handling, loop/partial indexes, and server response behavior.
5. Hidden-answer retention/clearing behavior.
6. Select/UnSelect conflict precedence. The new transaction groups same-type conditions with AND and rejects conflicting successful Select/UnSelect groups by default. Opt-in precedence policies are not claimed to match legacy behavior.

## Next milestone — repeated-section flow

Implement loop runtime instances only after verifying the original loop semantics and answer payload shape:
- stable runtime instance IDs and parent/loop relationships;
- repeated section order and entry/exit conditions;
- per-instance visibility and validation projections;
- previous/next navigation across repeated instances;
- no cross-instance answer leakage;
- serialization mapping to the legacy loop/partial-index payload.

The current flow projection deliberately marks visible Loop sections as not ready and represents them once only. Do not remove that guard until repeated-instance behavior is implemented and tested.

## Validation still open

The baseline validator currently covers required values, hidden/inactive/unknown visibility states, unknown option IDs, and Point numeric bounds. Use the original source to add type-specific rules for Numeric, Date, Matrix, FileUpload, DynamicAnswer, Payment, descriptions, masks, and any other supported types. Do not infer min/max selection-count semantics from DTO property names alone.

## Integration

- Migrate question types incrementally behind the typed lazy renderer registry.
- Implement exact legacy serialization and submission behavior from verified request fixtures.
- Add browser parity tests and compare runtime/memory metrics against the baseline.
