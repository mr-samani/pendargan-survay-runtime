# Saved answer restore

## Source of truth

This adapter follows the archived production `ConverterDataService.setAnswerInQuestions` and the surrounding `loadSavedData` loop traversal.

## One-based and zero-based loop indexes

The backend `FormSectionLoopQuestionAnswerDto.loopNumber` is one-based. The original client stores `loopNumber - 1` in its local page model. The rewrite's restore integration must preserve this conversion and keep the UI iteration index zero-based.

## Question restore mapping

| Type family | Restore behavior observed in the legacy client |
|---|---|
| Choice, Matrix radio/checkbox, Emoji, image choice, HasPriority | Iterate answer rows in server order, match option unique IDs, mark selected, restore option order and option-specific answer descriptions; rebuild answer as comma-separated option IDs |
| Scalar text/date/time/contact/numeric/Point/Rating/NPS/Location/PostalCode/CustomMask | Use the first row's answerDescription; if non-empty and the question has an editable initial value, clear the hasInitialValue flag |
| FileUpload | Use first answer row; map each file detail with a nested file into the client file model |
| DynamicAnswer | Use first row's dynamicDataRecordId, answerTitle, and jsonValuesDictionary |
| SkuCount / SkuCount_Dynamic | Rebuild selected SKU items from every answer row; quantity starts at 1, total is parsed from answerDescription, and history/ordering/retail variables/child questions are initialized |
| RetailAudit | Rebuild retail items from all repeated section pages, locate the RetailAudit row, restore other child questions, and compute formValid from required visible active children |
| Captcha / Payment | Restore validationKey from answerDescription and answer value from validationGuid |
| Group and container/content types | The legacy restore switch does not assign a direct answer value |

After the type-specific switch, the legacy client also assigns question.descriptionAnswer to the first non-empty answerDescription when either the definition or saved DTO indicates hasDescription.

## Implemented first-pass adapter

`restoreQuestionAnswer` is pure and returns:
- an immutable QuestionAnswerState;
- diagnostics for missing option IDs, mismatched question IDs, invalid SKU totals, and unsupported types;
- hasSavedAnswer;
- shouldClearEditableInitialValue, only for the scalar family where the legacy source performs this update.

Complex value conventions align with the serializer: selection descriptions are represented under `value.descriptionAnswer` and `value.optionDescriptions`; DynamicAnswer and SKU are JSON objects/arrays; file values are plain JSON records; Captcha/Payment use `validationKey` and `answer`.

## Explicit remaining work

- Section-level orchestration must create the right answer instance for each saved loop page and restore each page's variables.
- RetailAudit needs a dedicated section-level adapter because it depends on sibling repeated pages and child question trees.
- The old client rebuilds full UI file objects using `AppConsts.fileServerUrl`; this pure adapter retains server file metadata and address fields but does not depend on global application configuration.
- Popup sections are marked filled during restore by the legacy loader; regular sections are not. The future flow restore controller must preserve this distinction.
- Temporary voter elapsedTime is restored separately from question answers.
