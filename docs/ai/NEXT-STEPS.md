# Next steps

The original production ZIP has been inspected for loop navigation and repeated-section persistence. Keep the rewrite independent and preserve verified behavior through explicit contracts and tests.

## Immediate next milestone — runtime controller

- Introduce a runtime controller that owns the current page ID, active section ID, and active answer instance ID.
- On section completion, evaluate the SectionLoop expression for the current section and call advanceSurveyLoopFromEvaluation.
- If true, navigate to the newly created or reactivated iteration.
- If false, close the loop path and navigate to the next visible section.
- On backward navigation into an earlier iteration, call activateSurveyLoopIteration before exposing its answers.
- Ensure every input command, validation call, visibility projection, and action transaction uses the current page's answerInstanceId.
- Block transition when the loop expression is unresolved or the max-iteration guard is reached.

## Then — question answer serializer

Use the original ConverterDataService.getAnswerOfQuestion as the behavior reference. Implement one explicit serializer per question family:
- option selections and option-specific descriptions;
- HasPriority order;
- SKU and dynamic SKU;
- scalar text/numeric/date/time/contact/location answers;
- Point scale and NPS special title behavior;
- DynamicAnswer record ID/title;
- FileUpload and VoiceRecord file references/order;
- Captcha, Payment, and Group payloads;
- RetailAudit conversion separately.

Keep all output in generated DTO types. Use sourceId/uniqueId for backend IDs, not the definition's preferred uniqueIdPerForm runtime key. Add golden fixtures for each family before calling the serializer production-ready.

## Then — full submission adapter

Assemble the complete CreateVoterWithDetailsDto:
- guid and voterDetail metadata;
- ordered formSections loop envelopes;
- variablesLastValue merged in legacy order;
- allocationType, temporarySave, acceptPreviousData;
- partialRegisterForPayment only for the partial payment flow;
- exact file and payment fields.

Do not infer omitted API fields or submit incomplete serialization output. Use explicit diagnostics and golden JSON fixtures.

## Remaining behavior to verify

- Hidden-answer retention/clearing policy.
- RetailAudit conversion, dynamic record identity, and duplicate DynamicAnswer option rules.
- Quota, EndForm/SubmitForm, post-submit actions, and dynamic-answer filtering.
- Temporary save, full save, partial payment save, and server response behavior.

## Renderer and quality work

- Migrate question types incrementally behind the typed lazy renderer registry.
- Add browser parity tests for repeated section navigation, answer isolation, reload/load, and submission.
- Compare runtime and memory metrics against the recorded bundle baseline.
