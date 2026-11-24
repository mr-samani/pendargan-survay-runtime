# Observed legacy behavior

This document records only behavior visible in the checked-in Angular client and generated DTOs. It does not assume that the repository contains the full production client.

## Initialization

`VoteService.handleFormDetailsData()`:
- reads `showOneQuestionInAnyPage` and `showQuestionNumberInPollingPage` from `resp.poll`;
- initializes active questions;
- initializes `formExpressions`;
- does not initialize `formGlobalVariables`, sections, loop instances, or submission state in the checked-in implementation.

`iniitlizeQuestions()`:
- filters questions where `isActive` is truthy;
- sorts by `sortKey`;
- creates `QuestionModel` instances;
- loads each renderer sequentially with `await q.loadComponent()`;
- initializes the reactive form object with `@Q{questionFid}` and `A{optionFid}` keys;
- stores a human-readable state map for those keys.

The question and option formula IDs are derived from `uniqueIdPerForm` with hyphens removed.

## Answer state written by the current renderers

The form model is created by `FormulaEngineService.createReactiveModel()`.

For a question, the current renderers use a root object at `@Q{questionFid}`. The question object has an `answer` property and option booleans at `A{optionFid}`.

The checked-in UniqueSelect renderer writes:
- every option boolean (clearing all, then setting the selected option);
- `answer` to the selected option's `uniqueId`;
- `Point`, `AnswerTitle`, `PointWeigth`, `SelectedCount`, and `AnswersCount`.

The checked-in MultiSelect renderer writes:
- `answer` as a comma-separated list of selected option IDs;
- `Point`, `AnswerTitle`, `PointWeigth`, `SelectedCount`, and `AnswersCount`.

These are current renderer behaviors, not a complete specification for all question types.

## Expression initialization and evaluation

`initializeExpressions()`:
- skips entries without expression source;
- registers each expression in `FormulaEngineService` using `uniqueId`;
- only attaches expressions with `FormExpressionTypeEnum.InsideForm`;
- only dispatches `ExpressionTargetsEnum.Question` and `ExpressionTargetsEnum.Answer`;
- finds the owning question using `formQuestionUniqueId`;
- for Answer targets, finds the option using `targetKey`;
- stores expressions in buckets indexed by `ExpressionActionsEnum`.

Other expression scopes, targets, and actions are not handled in the checked-in client code.

`QuestionModel.canShow` is a computed signal that evaluates question Show/Hide expressions and then calls `checkOptionExpr()`. This means option evaluation and mutation occur as a side effect of a computed derivation.

`checkOptionExpr()` evaluates Show, Hide, Select, and UnSelect expressions for every option, but only applies the Show/Hide result to `opt.canShow`. The Select/UnSelect results are calculated but not applied in the inspected code. `opt.canShow` is a plain mutable property, not a signal.

The new runtime must not copy this side-effect pattern. Formula evaluation should produce results; an explicit action transaction should mutate runtime state.

## DTO evidence for omitted runtime paths

Generated API models expose additional contracts:

- `GetAllFormDetailForViewOutputDto` includes sections, questions, options, global variables, expressions, poll/form metadata, statuses, demography, system data, and temporary-voter data.
- `FormSectionTypeEnum` includes Normal, PopUp, and Loop.
- `FormSectionQuestionAnswerDto` groups answers by section.
- `FormSectionLoopQuestionAnswerDto` carries a loop number, section question answers, and voter variables.
- `RepeatedFormSectionDto` carries repeated-section answers and `variablesRepeatedSectionValue`.
- `AddOrUpdateQuestionAnswerDetailsInputDto` exposes answer details, file upload IDs, loop/partial indexes, `hasLoop`, and `questionVariablesValue`.
- `CreateVoterAnswerDetailDto` includes question/option IDs, title/description, files, dynamic data record ID, validation GUID, and initial-value fields.
- `VoterAnswerDetailDto` includes scores, order, files, settings, JSON values, loop number, sequential IDs, and initial-value change metadata.
- `GetFormGlobalVariableDto` includes expression, title, type, unique IDs, activation, system/user-defined flags and optional question association.

The existence of these DTOs proves the API contract contains these concepts; it does not establish their runtime semantics or exact serialization rules.

## Missing evidence in this repository snapshot

- No client-side save/submit call was found in the checked-in app.
- No global-variable initialization was found in `VoteService`.
- No loop-instance creation/navigation implementation was found in the checked-in app.
- Only three question renderers are present.
- There are no anonymized production survey fixtures or expected submission payload fixtures.

Do not implement these missing behaviors from DTO names alone. Obtain the production source or representative anonymized API request/response fixtures first.
