# Testing strategy

## Unit tests

- DTO normalization and validation, including missing/unknown question types.
- Expression parsing, compilation, dependency extraction, cycles, and deterministic evaluation.
- Action precedence for Show/Hide/Select/UnSelect.
- Answer updates and serialization for each question type.
- Visibility aggregation from option to question to section.
- Navigation across hidden items, page modes, and loop instances.
- Renderer loader caching, concurrent loading, error handling, and unsupported IDs.

## Differential tests

Run the same action sequence through:
1. a verified legacy behavior adapter/reference implementation; and
2. the new runtime.

Compare visible items, selected answers, calculated values, validation results, next/previous targets, and serialized payloads after every action.

Generate randomized but valid DAGs and action sequences. Compare incremental evaluation to full recomputation after every transaction.

## Integration / E2E

Use anonymized survey fixtures and a real browser. Cover loading, first render, user interactions, conditional visibility, page navigation, loops, file questions, validation, save/submit, reload/resume, RTL/LTR, and keyboard-only interaction.

## Performance

Record:
- initial JS compressed and uncompressed size;
- each lazy renderer chunk size;
- network requests for a survey using only one/two question types;
- cold definition compilation time;
- warm expression evaluation;
- one answer update and full dependency propagation;
- p50/p95/p99 under representative large survey sizes;
- memory after load and after repeated loop navigation.

Do not mix cold and warm numbers. Include hardware, browser, Node version, survey fixture size, and commit SHA in every report.
