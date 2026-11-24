# Next steps

The original production archive is the behavior reference. Preserve verified semantics in clean, independently testable modules.

## Immediate next milestone — saved-answer restore

Implement a pure adapter from `GetVoterFullDetail` / `GetFormQuestionAnswerDto` and temporary-save data into immutable answer state and loop snapshots.

Port the observed `ConverterDataService.loadSavedData` and `setAnswerInQuestions` behavior:
- convert backend loopNumber (one-based) to zero-based iteration indexes;
- restore choice IDs, selected option order, and option-specific descriptions;
- restore scalar values and clear editable initial-value flags only when the legacy rules require it;
- restore file/voice references, DynamicAnswer identification/title/json values, SKU records, Captcha, and Payment validation values;
- rebuild RetailAudit selected items from the repeated section answer groups, including child questions and their validation status;
- preserve section ordering and the legacy RetailAudit break behavior.

Use generated service-proxy DTOs as inputs, return immutable state plus diagnostics, and never mutate the definition snapshot. Add fixtures derived from the archived DTO shape with anonymized IDs and no respondent data.

## Then — runtime controller

- Own current page ID, active section ID, and active answer instance ID.
- On section completion, evaluate the SectionLoop expression for that section and call advanceSurveyLoopFromEvaluation.
- Route true to the newly created/reactivated iteration; route false to the next visible section.
- On backward navigation, activate the earlier iteration before exposing answers.
- Ensure input commands, validation, visibility, and actions use the active page's answerInstanceId.
- Block transitions when the loop expression is unresolved or the iteration guard is reached.

## Then — complete save orchestration

- Supply evaluated visibility, end-form state, and evaluated initial values to the per-question serializer.
- Reconcile generated DTO differences against the live API: dynamicDataRecordId string/number and fileId omission.
- Implement RetailAudit conversion to synthetic DynamicAnswer-like repeated pages, with temporary-save vs final-save validity filtering.
- Add full golden JSON fixtures for each supported question family.
- Integrate geo-location, poll route, audio recording, timer stop/restart, temporary save, full save, partial payment save, and response/error callbacks.
- Verify quota, EndForm/SubmitForm, PreventSubmit, post-submit tracking, and dynamic-answer filtering.

## Renderer and quality work

- Migrate question types incrementally behind the typed lazy renderer registry.
- Add browser parity tests for repeated section navigation, answer isolation, restore/reload, and final submission.
- Compare runtime and memory metrics against the recorded bundle baseline.
