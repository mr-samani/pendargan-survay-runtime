# Next steps

The original production archive is the behavior reference. Preserve verified semantics in clean, independently testable modules.

## Immediate next milestone — concrete runtime projector

The session controller now owns current-page state, atomic command dispatch, validation-gated navigation, and SectionLoop transitions. Its projector is deliberately injected. Implement the concrete adapter that connects the existing pure modules:

- Evaluate formulas against the active answer instance and its loop-variable snapshot.
- Resolve InsideForm visibility and supported Select/UnSelect action transactions.
- Re-evaluate after answer-changing actions until the action/answer state reaches a stable revision, with a bounded pass count and cycle diagnostics.
- Build visibility, validation, and flow projections from the same committed answer revision.
- Preserve the active page when it remains visible; otherwise select a deterministic valid page.
- Ensure formula scopes never leak variables between loop iterations or survey instances.

Add deterministic tests for action-triggered recalculation, visibility changes, action conflicts, loop-specific variables, and bounded non-convergence.

## Then — renderer integration

- Connect renderer input/output adapters to immutable answer commands.
- Define and test canonical answer value shapes for Matrix, Group, SKU, DynamicAnswer, files, Payment, Captcha, and RetailAudit.
- Add renderer parity incrementally behind the lazy registry.

## Then — complete save orchestration

- Supply evaluated visibility, end-form state, and evaluated initial values to the per-question serializer.
- Reconcile generated DTO differences against the live API: dynamicDataRecordId string/number and fileId omission.
- Implement RetailAudit conversion to synthetic DynamicAnswer-like repeated pages, with temporary-save vs final-save validity filtering.
- Add full golden JSON fixtures for each supported question family.
- Integrate geo-location, poll route, audio recording, timer stop/restart, temporary save, full save, partial payment save, and response/error callbacks.
- Verify quota, EndForm/SubmitForm, PreventSubmit, post-submit tracking, and dynamic-answer filtering.

## Quality and rollout

- Add browser parity tests for repeated section navigation, answer isolation, restore/reload, and final submission.
- Compare runtime and memory metrics against the recorded bundle baseline.
- Define feature flag and rollback strategy only after behavioral parity gates pass.
