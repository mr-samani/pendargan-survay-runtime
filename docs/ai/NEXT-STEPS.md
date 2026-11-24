# Next steps

The full-recalculation evaluator is now the correctness oracle. Do not replace it with incremental evaluation until both produce identical results for the same inputs.

## Discovery still required

1. The checked-in client currently has only three renderer implementations: HtmlFrame, UniqueSelect and MultiSelect. Verify whether the rest of the production renderers are in another repository or intentionally absent.
2. The current `VoteService` does not initialize `formGlobalVariables`; verify the real global-variable registration and exact `[%name%]` naming convention.
3. The current expression dispatcher handles only InsideForm Question/Answer targets. Verify all action/target/scope enum cases, especially quota, section loops, form actions, post-submit actions and dynamic-answer filters.
4. No answer save/submit service call exists in the checked-in app. Provide the production API flow or fixtures before implementing payload generation.
5. Create anonymized fixtures for simple selection, multi-select, conditional visibility, formulas, one-question-per-page, section loops, quotas, and complex question types.

## Next runtime milestone — incremental evaluator

Implement dirty-node evaluation on top of the same graph:
- maintain last input/formula values per runtime instance;
- accept a batch of changed question/option/scope inputs;
- mark only reachable dependent formula nodes dirty;
- recompute in topological order;
- update global-variable values in the isolated formula-engine context;
- return the same proposed-action shape as the full evaluator;
- stop propagation when a value is unchanged;
- never apply actions during formula evaluation.

Add differential tests that execute identical randomized action sequences through the full evaluator and incremental evaluator and compare formula values, global variables, diagnostics, and action proposals after every step.

## Then

- Define answer state and explicit runtime commands.
- Add action conflict resolution and one atomic state transaction.
- Add visibility aggregation, validation, and navigation.
- Add repeated section runtime instances using stable instance IDs.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Implement exact legacy serialization and submission behavior only after payload fixtures exist.
