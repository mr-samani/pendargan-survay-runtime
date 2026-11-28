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

The host must adapt the existing generated/API contracts to these ports. SignalR is delivered through acceptSignalRStatus; status events are ignored unless both the reserved survey GUID and current transaction ID match.

## Safety and lifecycle rules

- Duplicate checkout, polling, cancellation and validation requests are guarded.
- The amount used to validate payment is snapshotted at transaction creation. A later formula-driven amount change cannot silently validate the old transaction against a new amount.
- Only a syntactically valid server-issued GUID is accepted as a payment answer.
- The transaction ID is used as validationKey; it is never written as the answer value.
- Expiry invalidates the pending answer and releases the previous-question lock.
- dispose() invalidates pending validation completions; the Angular host must also unsubscribe its SignalR listener and timer.
- Optional Payment questions do not block form validation before a payment is made; required Payment questions do.

## Integration status

The pure state machine and deterministic tests are implemented. The Angular Payment renderer, actual HTTP/API adapters, SignalR connection lifecycle, partial-save wiring to RuntimeSubmissionCoordinator, popup fallback, and end-to-end gateway verification are not yet implemented. Therefore Payment is not added to SUPPORTED_QUESTION_RENDERER_TYPES and RENDER-004b remains partial/open.
