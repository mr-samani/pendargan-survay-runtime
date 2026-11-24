# Next steps

Do not jump directly into action execution. First make the graph behavior agree with production semantics.

## Discovery still required

1. The checked-in client currently has only three renderer implementations: HtmlFrame, UniqueSelect, and MultiSelect. Verify whether the rest of the production renderers are in another repository or intentionally absent.
2. The current `VoteService` does not initialize `formGlobalVariables`; verify the real global-variable registration and exact `[%name%]` naming convention.
3. The current expression dispatcher handles only InsideForm Question/Answer targets. Verify all action/target/scope enum cases, especially quota, section loops, form actions, post-submit actions and dynamic-answer filters.
4. No answer save/submit service call exists in the checked-in app code. Provide the production API flow or fixtures before implementing payload generation.
5. Create anonymized fixtures for simple selection, multi-select, conditional visibility, formulas, one-question-per-page, section loops, quotas, and complex question types.

## Next runtime milestone — full recalculation oracle

Implement a deterministic full-recalculation engine using the typed graph:
- calculate global variables in topological order;
- evaluate expression formulas against a single answer-state snapshot;
- collect proposed actions without mutating state during formula evaluation;
- resolve conflicting actions using a documented precedence policy;
- apply all state changes in one transaction;
- recompute visibility aggregates and navigation state after the transaction.

Keep the full evaluator intentionally simple and correct. It will become the reference implementation for the later incremental evaluator.

## Then

- Add dirty-node incremental evaluation and differential tests against the full oracle.
- Add answer state and explicit commands.
- Add visibility aggregation, validation, and navigation.
- Add repeated section runtime instances using stable instance IDs.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Implement exact legacy serialization and submission behavior only after payload fixtures exist.
