# Next steps

The session controller and concrete projector now connect the pure runtime modules. The original application is checked in under `PREVIUOS_SOURCE/`; the first pass through its formula implementation is complete and recorded in `docs/architecture/LEGACY-FORMULA-COMPATIBILITY.md`.

## Immediate next milestone — integrate legacy formula and global-variable evaluation

The archived implementation is centered on:

- `LogicService.generateAnswerStates()`: creates the flat `Q{fid}.*` answer-state dictionary.
- `LogicService.replaceFormulaValues()`: substitutes answer-state tokens and assigns null to missing tokens.
- `LogicService.replaceGvarValues()`: substitutes `[%title%]` global variables before answer tokens.
- `LogicService.calculateGvars()` and `calculateFormulas()`: preserve question ownership and question-walk evaluation order.
- `ExpEvaluator`: mathjs-backed expression evaluation with legacy custom functions.

The documented token families include choice flags and aggregates, scalar text/numeric/point values, matrix cell values, SKU sums, DynamicAnswer filter placeholders, RecordsOtherForms fields, Captcha validity, and Region.UniqueId.

The flat-token projection/substitution adapter, question-owned global-variable evaluator, question-variable index, and initial-value/Payment/secondary-filter effect projectors now exist. Keep them separate from canonical answer state. Next, wire their returned answer commands and dynamic-filter refresh requests into the session controller in a deterministic transaction, then prove parser/function parity without copying the unsafe `new Function` branch.

### Required compatibility tests

- Golden token maps for every question type supported by the legacy `generateAnswerStates` switch, including currently untested Point, Captcha and every matrix/dynamic variant.
- Choice selected/visible counts, answer titles, point totals, and weighted points.
- Hidden question and hidden option behavior.
- Scalar empty/null handling and numeric fallback behavior.
- Matrix text/numeric cell values.
- SKU totals and dynamic filter placeholders.
- RecordsOtherForms numeric vs quoted-string values.
- Region.UniqueId with and without a region.
- Missing-token substitution to null.
- Global-variable replacement before answer-token replacement, including string quoting, case-insensitive title replacement, and global-variable tokens already substituted before the answer-token pass.
- Session-owned dispatch for changed initial values and dynamic-filter refreshes, plus full question-walk scheduling across section/loop boundaries.
- Connect the tested legacy function library to a supported parser extension point. A direct `createReactiveModel` scope injection attempt failed with the installed `ngx-exp-parser`; do not reintroduce that path without proving function dispatch. Then verify random(key), endsWith, startsWith, contains, avgWeakData, loose equality, parser operators, and strict boolean action results.
- Formula result strict-boolean enforcement and evaluation-error behavior.

The legacy `new Function` branch must not be reintroduced. If the modern parser cannot express a legacy construct safely, mark it as an explicit compatibility limitation and provide a migration path.

Do not enable the compatibility adapter as the production formula scope until these fixtures and real payload checks pass.

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
