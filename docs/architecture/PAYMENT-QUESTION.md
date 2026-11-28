# Payment question runtime

## Legacy behavior contract

The archived Payment question is a required/optional GUID-valued answer control with a host-managed transaction lifecycle:

1. Checkout is blocked in preview mode, when the amount is missing, or when an earlier question is invalid.
2. The survey is partially saved before a payment transaction is created. The partial save includes the payment question ID and selected tenant gateway ID.
3. Previous questions are disabled after checkout starts. If the partial save fails, they are re-enabled. Once the partial save succeeds, a failed gateway request can be retried without saving the survey again.
4. The transaction is created/reused with reservedPollGuid, formQuestionUniqueId, numeric amount, gateway ID, description and optional transaction ID.
5. The returned transaction ID correlates polling and SignalR events. Paid/Completed status must still be validated against the configured amount through ConfirmPayment.
6. Only the server-issued validation GUID is written as the answer; the transaction ID is retained as the validation key.
7. Cancellation or expiry clears the answer and unlocks previous questions. A validated payment cannot be cancelled from the question UI.

The source contract is in PREVIUOS_SOURCE/app/vote/elements/payment/payment.component.ts and its sibling model.ts.

## Runtime implementation

projects/vote/src/app/runtime/payment/payment-question-runtime.ts implements the framework-agnostic state machine. It deliberately does not depend on Angular, browser globals, HTTP, SignalR, timers or the legacy VoteService.

PaymentQuestionPorts defines the host boundary for:
- partial survey save;
- create-or-get transaction;
- transaction status refresh;
- server-side payment validation;
- cancellation;
- opening the gateway URL;
- locking/unlocking previous questions;
- publishing the validated GUID answer.

The verified HTTP boundary is implemented in `payment-question-api-adapter.ts`. It uses the configured root `API_BASE_URL` and the archived relative routes:

- `/PublicPollPaymentTransaction/GetOrAddPollPaymentTransaction`
- `/PublicPollPaymentTransaction/GetTransactionInfo`
- `/PublicPollPaymentTransaction/CancelPollPaymentTransaction`
- `/VoterAnswerDetailValidation/ValidateVoterAnswerDetailData`

The ConfirmPayment validation enum value is `8`, verified from the archived DTO. The adapter unwraps ABP envelopes, propagates business failures, rejects unknown transaction statuses and maps the server-issued validation GUID without manufacturing defaults.

The canonical partial-save path is now available through `VoteComponent.submitPartialPayment`. `buildSurveyRuntimeSubmission` validates that the payment question is uniquely resolved and that every earlier question is valid (or explicitly skipped) before allowing an incomplete partial payload. This matches the legacy rule: answers after the payment question do not block the partial save. The VoteService also exposes overlapping-safe previous-question locks, and VoteComponent applies them to renderer inputs and host upload controls.

SignalR is still delivered through `acceptSignalRStatus`; the actual connection lifecycle and event subscription adapter remain open. The host must filter/teardown subscriptions and call `dispose()` on question destruction.

## Safety and lifecycle rules

- Duplicate checkout, polling, cancellation and validation requests are guarded.
- The amount used to validate payment is snapshotted at transaction creation. A later formula-driven amount change cannot silently validate the old transaction against a new amount.
- Only a syntactically valid server-issued GUID is accepted as a payment answer.
- The transaction ID is used as validationKey; it is never written as the answer value.
- Expiry invalidates the pending answer and releases the previous-question lock.
- dispose() invalidates pending validation completions; the Angular host must also unsubscribe its SignalR listener and timer.
- Optional Payment questions do not block form validation before a payment is made; required Payment questions do.

## Integration status

The framework-agnostic state machine, verified HTTP adapter, ordered partial-save guard, canonical partial-save host method, and previous-question lock bridge are implemented and covered by deterministic tests. The latest CI run 46130659612 passed production build and all 414 tests (64 files, 1 skipped). The Angular Payment UI, SignalR connection lifecycle, timer scheduling, popup fallback, payment answer bridge into the live canonical session, and end-to-end gateway verification remain open. Payment is intentionally not added to `SUPPORTED_QUESTION_RENDERER_TYPES`; it is excluded from the generic lazy-renderer bootstrap and shown as unavailable rather than silently creating an empty component.
