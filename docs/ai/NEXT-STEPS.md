# Next steps

The answer store owns user-input state independently of the legacy form object. The visibility engine is a pure projection and does not mutate answer state. Do not add expression actions directly to the answer reducer.

## Discovery still required

1. The checked-in client currently has only three renderer implementations: HtmlFrame, UniqueSelect and MultiSelect. Verify whether the rest of the production renderers are in another repository or intentionally absent.
2. The current `VoteService` does not initialize `formGlobalVariables`; verify the real global-variable registration and exact `[%name%]` naming convention.
3. The current expression dispatcher handles only InsideForm Question/Answer targets. Verify all action/target/scope enum cases, especially quota, section loops, form actions, post-submit actions and dynamic-answer filters.
4. No answer save/submit service call exists in the checked-in app. Provide the production API flow or fixtures before implementing payload generation.
5. Confirm whether hidden answers are preserved, cleared, or restored when a question/option becomes hidden.
6. Confirm conflict precedence when Show and Hide, or Select and UnSelect, target the same item in one evaluation transaction.

## Next runtime milestone — action transaction

Build a transaction layer that consumes `ProposedSurveyAction[]`, the immutable definition, visibility projection, and answer-state snapshot:
- resolve all proposals against the immutable definition;
- apply explicit conflict precedence, not evaluation-order side effects;
- apply Select/UnSelect through answer-state commands;
- calculate required/validity state independently from visibility;
- keep visibility calculation pure and commit all runtime projections once;
- implement the confirmed hidden-answer policy;
- increment the runtime revision once per transaction.

Do not choose action precedence or hidden-answer behavior from the incomplete legacy implementation. Obtain representative fixtures or explicit owner decisions first.

## Then

- Implement validation and normal navigation, including one-question-per-page mode.
- Implement repeated section runtime instances and loop navigation using answer instance namespaces.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Implement exact legacy serialization and submission behavior only after payload fixtures exist.
