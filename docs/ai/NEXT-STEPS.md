# Next steps

The session controller and concrete projector now connect the pure runtime modules. Continue by validating formula input scope against the legacy client before wiring renderers.

## Immediate next milestone — formula scope adapter

The concrete projector accepts an application-owned formula evaluator and provides `createSurveyFormulaEvaluator` to bind `evaluateSurveyFully` to a parser engine. The remaining high-risk piece is the scope factory:

- Define the exact question and option aliases consumed by legacy formulas.
- Project answer values and selected options into the same expression-readable shape as the old client.
- Merge global variables without allowing one survey/session to leak values into another.
- Inject loop-local variable snapshots only for the active repeated-section instance.
- Preserve undefined/unanswered semantics rather than converting every missing value to null, empty string, or false.
- Add source-derived fixtures for scalar, choice, matrix, SKU, DynamicAnswer, and repeated-section formulas.
- Verify parser errors and missing references produce diagnostics and block unsafe navigation.

Do not infer alias rules from DTO names. Verify them against the legacy logic service and formula package contract.

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
