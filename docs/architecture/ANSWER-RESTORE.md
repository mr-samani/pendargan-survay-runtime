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
| VoiceRecord | The original `setAnswerInQuestions` switch has no direct restore case; voice recording metadata is exposed separately on voter detail |
| Captcha / Payment | Restore validationKey from answerDescription and answer value from validationGuid |
| Group and container/content types | The legacy restore switch does not assign a direct answer value |

After the type-specific switch, the legacy client also assigns question.descriptionAnswer to the first non-empty answerDescription when either the definition or saved DTO indicates hasDescription.

## Implemented restore adapters

`restoreQuestionAnswer` is pure and returns:
- an immutable QuestionAnswerState;
- diagnostics for missing option IDs, mismatched question IDs, invalid SKU totals, and unsupported types;
- hasSavedAnswer;
- shouldClearEditableInitialValue, only for the scalar family where the legacy source performs this update. This signal is also retained in the hydrated answer state.

Complex value conventions align with the serializer: selection descriptions are represented under `value.descriptionAnswer` and `value.optionDescriptions`; DynamicAnswer and SKU are JSON objects/arrays; file values are plain JSON records; Captcha/Payment use `validationKey` and `answer`.

## Section-level restore now implemented

- `restoreSurveyFromBackend` maps section IDs, traverses saved loop pages, converts one-based backend loop numbers to zero-based runtime indexes, creates isolated answer instances, hydrates each page's questions, and restores temporary elapsed time.
- Non-contiguous loop indexes and repeated pages without an active SectionLoop expression are rejected with diagnostics.
- The legacy popup rule is preserved: restored iterations are marked filled only when the section is a popup; regular restored iterations are not marked filled.
- The legacy loader initializes each page's `variables` as an empty object and does not restore `voterVariables`; the rewrite currently preserves this behavior rather than inferring a new formula-variable contract.
- A section containing a RetailAudit question is restored as one parent answer containing all repeated RetailAudit items, rather than as ordinary loop iterations. The first page containing the RetailAudit question is the parent page; later page data feeds its item list.

## Explicit remaining work

- Verify RetailAudit restore against a broader golden fixture with nested Matrix/Group children, deleted child questions, and required/hidden combinations.
- RetailAudit now has a dedicated section-level adapter. It scans every repeated page, restores each RetailAudit item and its child question tree, and computes formValid using the legacy required/active/hidden/end-form conditions.
- The old client rebuilds full UI file objects using `AppConsts.fileServerUrl`; this pure adapter retains server file metadata and address fields but does not depend on global application configuration.
- The original restore switch has no VoiceRecord case; the new adapter deliberately leaves VoiceRecord restore unsupported rather than assuming FileUpload parity.
- Temporary `completePercentage` is surfaced as informational metadata; the legacy `loadSavedData` itself only restores elapsedTime.
- Popup sections are marked filled during restore by the legacy loader; regular sections are not. The future flow restore controller must preserve this distinction.
- Temporary voter elapsedTime is restored separately from question answers.
