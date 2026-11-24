# Next steps

The full evaluator is the correctness oracle. The incremental evaluator currently passes deterministic parity tests; expand differential coverage before using it as the production path.

## Discovery still required

1. The checked-in client currently has only three renderer implementations: HtmlFrame, UniqueSelect and MultiSelect. Verify whether the rest of the production renderers are in another repository or intentionally absent.
2. The current `VoteService` does not initialize `formGlobalVariables`; verify the real global-variable registration and exact `[%name%]` naming convention.
3. The current expression dispatcher handles only InsideForm Question/Answer targets. Verify all action/target/scope enum cases, especially quota, section loops, form actions, post-submit actions and dynamic-answer filters.
4. No answer save/submit service call exists in the checked-in app. Provide the production API flow or fixtures before implementing payload generation.
5. Create anonymized fixtures for simple selection, multi-select, conditional visibility, formulas, one-question-per-page, section loops, quotas, and complex question types.

## Next runtime milestone — answer state and action transaction

Define mutable runtime state separately from the immutable definition:
- typed answer values keyed by stable question/option IDs and runtime loop-instance IDs;
- explicit input commands for selection, text/file changes, reset and restore;
- a transaction boundary that applies proposed actions after formula evaluation;
- explicit policy for conflicting Show/Hide, Select/UnSelect and Required/NotRequired actions;
- a documented policy for whether hidden answers are preserved, cleared or restored;
- one commit/notification per user action batch.

Do not guess action precedence or hidden-answer behavior from the current incomplete `QuestionModel`; confirm it from production fixtures or the owner first.

## Then

- Add randomized/property-based full-vs-incremental differential tests.
- Implement option/question/section visibility aggregation.
- Implement validation, normal navigation and one-question-per-page mode.
- Implement repeated section runtime instances with stable instance IDs.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Implement exact legacy serialization and submission behavior only after payload fixtures exist.
