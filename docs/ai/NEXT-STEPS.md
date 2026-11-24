# Next steps

The original production ZIP is available as a behavior reference and has been inspected for loop navigation and persistence. Keep the rewrite independent; only carry verified contracts forward.

## Immediate next milestone — connect loop decisions to the evaluator and navigation

- Resolve active SectionLoop expression target keys to stable section IDs.
- At the section transition, read the evaluated tri-state formula result and call advanceSurveyLoop.
- If true, navigate to the newly created iteration and use its answerInstanceId for every question read/write.
- If false, close the loop and navigate to the next visible section.
- If unknown or invalid, block transition and surface a deterministic diagnostic.
- Recompute visibility and validation in the current iteration's answer namespace, not the root namespace.

## Then — submission adapter

Map the new immutable state to the verified legacy request contract:
- formSections is an ordered list of section objects containing repeatSections;
- each repeat section contains voterAnswerDetails and variablesRepeatedSectionValue;
- iteration ordering is zero-based in the client, while auto-save loopIndexNumber is one-based;
- preserve dynamicDataRecordId for RetailAudit-derived rows;
- include only iterations meeting the legacy filled/temporary-save rules, after those rules are fully verified;
- variablesLastValue is the merge of variablesRepeatedSectionValue across submitted iterations.

Do not serialize by simply dumping the runtime objects. Build a dedicated adapter with golden request fixtures.

## Remaining behavior to verify

1. Full answer conversion for every question type, file upload and description payloads.
2. Hidden-answer retention/clearing policy.
3. RetailAudit conversion and duplicate DynamicAnswer option behavior.
4. Quota, end-form/submit actions, post-submit actions, and dynamic-answer filtering.
5. Full/temporary/partial payment-save rules and server response behavior.

## Renderer and quality work

- Migrate question types incrementally behind the typed lazy renderer registry.
- Add browser parity tests for repeated section navigation, answer isolation, reload/load, and submission.
- Compare runtime and memory metrics against the recorded bundle baseline.
