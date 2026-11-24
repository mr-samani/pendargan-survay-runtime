# Next steps

The definition compiler, formula graph/evaluators, answer store, visibility projection and a first action transaction are implemented. Keep formula evaluation, visibility projection and answer mutation as separate layers.

## Known evidence gaps

1. The checked-in app currently has three renderer implementations: HtmlFrame, UniqueSelect and MultiSelect. Verify whether the other production renderers are in another repository or intentionally absent.
2. The checked-in `VoteService` does not initialize `formGlobalVariables`; verify the exact legacy variable names and aliases.
3. Only InsideForm Question/Answer expression dispatch is present in the checked-in app. Quota, section loops, form-level actions, post-submit actions and dynamic-answer filters need verified semantics.
4. No answer save/submit service call exists in the checked-in app. Capture the production API request/response and anonymized fixtures before implementing payload generation.
5. Hidden-answer retention/clearing behavior is unknown.
6. Select/UnSelect conflict precedence is unknown. The new transaction rejects conflicts by default and offers explicit opt-in policies; do not claim either opt-in policy is legacy-compatible without evidence.

## Next milestone — validation projection and flow model

Implement validation as a pure projection over definition + answer snapshot + visibility:
- required and optional answers;
- min/max selection/count rules;
- numeric bounds and decimal steps where the question type supports them;
- hidden/disabled question behavior only after policy is verified;
- diagnostics tied to stable question/option IDs.

Then build a flow model independent from Angular components:
- visible section ordering;
- visible question ordering;
- normal next/previous navigation;
- one-question-per-page projection;
- loop runtime instances only after loop semantics and instance-scoped answer payloads are verified.

Keep navigation as a projection over runtime state; do not embed it in renderer components or computed template getters.
