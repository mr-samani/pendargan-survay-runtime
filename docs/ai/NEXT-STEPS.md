# Next steps

The session controller and concrete projector now connect the pure runtime modules. An immutable namespaced formula-scope projection has also been added, but it is not yet a verified replacement for the legacy formula scope.

## Immediate next milestone — legacy formula parity

The new `createSurveyFormulaScope` exposes:

- `survey`: survey identity.
- `runtime`: active answer instance and repeated-section coordinates.
- `loop.variables`: variables for the active repeated-section iteration.
- `answers`: separate indexes by question ID, uniqueIdPerForm, and source ID.
- `questions`: separate metadata indexes using the same identity namespaces.

It detaches nested answer values, freezes the projected scope, rejects ambiguous identifiers, and never mutates answer state.

This is only a structured baseline. The following remain unverified and must not be guessed:

- Exact legacy aliases consumed by expressions.
- How selected, scalar, matrix, SKU, DynamicAnswer, and unanswered values are represented to formulas.
- Whether formulas read question/option values from root aliases, helper functions, or nested objects.
- Global-variable precedence and loop-local shadowing.
- Parser property-access rules and missing-reference semantics.
- Formula package behavior for undefined, null, arrays, and object values.

Use the original logic service and real production expressions to add these compatibility rules. Do not enable the new scope as the production default until the parity fixtures pass.

## Then — action and visibility parity

- Verify source-order precedence for multiple SectionLoop expressions and Select/UnSelect conflicts.
- Add tests for action-triggered formula recalculation, visibility changes, hidden required questions, and action cycles.
- Extend supported action/target pairs only after their original behavior is traced.
- Preserve unsupported action proposals as explicit diagnostics.

## Then — renderer integration

- Connect renderer input/output adapters to immutable answer commands.
- Define canonical answer value shapes for Matrix, Group, SKU, DynamicAnswer, files, Payment, Captcha, and RetailAudit.
- Add renderer parity incrementally behind the lazy registry.

## Then — complete save orchestration

- Supply evaluated visibility, end-form state, and evaluated initial values to the per-question serializer.
- Reconcile generated DTO differences against the live API: dynamicDataRecordId string/number and fileId omission.
- Implement RetailAudit conversion to synthetic DynamicAnswer-like repeated pages, with temporary-save vs final-save validity filtering.
- Add full golden JSON fixtures for each supported question family.
- Integrate geo-location, poll route, audio recording, timer stop/restart, temporary save, full save, partial payment save, and response/error callbacks.
- Verify quota, EndForm/SubmitForm, PreventSubmit, post-submit tracking, and dynamic-answer filtering.

## Quality and rollout

- Add browser parity tests for repeated section navigation, answer isolation, restore/reload, and final submission.
- Compare runtime and memory metrics against the recorded bundle baseline.
- Define feature flag and rollback strategy only after behavioral parity gates pass.
