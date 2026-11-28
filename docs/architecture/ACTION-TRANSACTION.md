# Expression action transaction

The action transaction is separate from formula evaluation and visibility projection. It converts supported action proposals into answer-state commands and delegates atomic state mutation to the answer reducer.

## Supported subset

- `InsideForm` + `Answer` target + `Select` / `UnSelect`.
- The question resolves by source ID, per-form ID, or runtime definition ID.
- The option resolves by per-form ID, matching the checked-in legacy dispatcher.
- A false expression condition contributes false to its action group.
- Multiple conditions for the same target and action type are combined with AND, matching the checked-in legacy expression grouping.
- If every condition in a Select or UnSelect group is true, that group requests the corresponding selection state.

## Conflict policy

A Select and UnSelect group can both be true for the same option in one evaluation. No reliable precedence has been established from the checked-in client, so the default is `reject`: the entire action transaction is rejected and answer state remains unchanged.

A caller may explicitly choose `select-wins` or `unselect-wins`. This is an opt-in policy, not a claim about legacy behavior. Never switch the default without verified production fixtures or an explicit product decision.

## Unsupported behavior

Other action types, scopes, and targets are preserved in `unhandledActions` for dedicated handlers. Required/validity, submit/end-form, quota, loop, form-level and post-submit actions are not applied here.
