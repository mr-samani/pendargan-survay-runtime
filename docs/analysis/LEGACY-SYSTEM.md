# Legacy system observations

This document records only facts visible in the current checked-in source snapshot. It is not a complete production behavior specification.

## Entry and data loading

- Route shape: `:tenancyName/:shortLink`.
- `VoteResolver` resolves the short link to a poll GUID using `PollTokensVotingService.getPollGuidByToken()`.
- `VoteComponent` requests `getAllFormDetailForView()` and passes the response to `VoteService.handleFormDetailsData()`.
- The vote component renders `vote.questionList()`, filters with `question.canShow()`, displays a title component, and hosts the type component through `NgComponentOutlet`.

## Current question model

- `QuestionModel` extends `GetFormQuestionQuestionOptionDto`.
- It converts question options to `AnswerModel`, normalizes additional settings, sorts/randomizes options, creates child QuestionModels, stores a renderer Type, expression buckets, display description state, and save/invalid signals.
- The model's `canShow` computed reads Show/Hide expression arrays and then calls `checkOptionExpr()`.
- `checkOptionExpr()` loops over every option and evaluates Show/Hide/Select/UnSelect. In the checked-in code, only Show/Hide are assigned to `opt.canShow`; Select/UnSelect results are not committed to answer state.

## Current VoteService

- Owns `FormulaEngineService`, a reactive form object, question array, pagination signals, mode flags, stateMap, initialization and expression registration.
- It filters active questions and sorts by `sortKey`.
- For each question it constructs a QuestionModel, sets the back-reference to VoteService, assigns a row number and state-map entries, awaits renderer loading, initializes `@Q{fid}` and `A{fid}` fields, then pushes the question.
- The current initialization loop loads each question component sequentially.
- Expressions are registered with `registerFormula`; only expressions classified as InsideForm are assigned to a question or option expression bucket in the inspected code.

## Expression semantics still to verify

- Whether Show and Hide rules are combined with AND or OR in all cases.
- Precedence/conflict behavior when multiple actions target the same option.
- Whether Select and UnSelect are meant to update answers automatically, and in which order.
- Whether hidden answers are retained, cleared, or restored.
- Whether an option being hidden affects required/min/max validation and quota calculations.
- How formulas, global variables, entities, and cross-question references are populated.
- Whether expressions from other form expression types affect section visibility, flow, or external state.

## Flow and submission gaps

The inspected VoteService snapshot does not yet implement section navigation, loop-instance execution, validation orchestration, answer persistence/submission, or all question-specific interactions. These may exist elsewhere in the larger application; do not conclude they are absent from production based only on this subset.

## Known implementation risks to test

- Side effects inside `computed()` via `checkOptionExpr()`.
- Option expression scans may repeat whenever question visibility is read.
- Mutable plain fields such as `opt.canShow` are not themselves signal-tracked.
- `QuestionModel` and VoteService are tightly coupled.
- `Type<any>` weakens renderer contracts.
- Error messages in `DeclareQuestion()` need null-safe handling for missing type IDs.
- Sequential renderer awaits can add avoidable initialization latency.
