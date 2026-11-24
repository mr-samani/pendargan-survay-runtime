# Next steps

Work in this order. Do not skip discovery and jump directly into a broad rewrite.

## Immediate

1. Confirm repository visibility is intentional; it is currently public.
2. Confirm whether this checked-in client is the complete source snapshot or whether other production question renderers, section/loop logic, and submission code still need to be added.
3. Inspect all response DTOs, section DTOs, answer DTOs, expression action/target enums, and all save/submit code.
4. Create anonymized fixtures for representative surveys: simple selection, multi-select, conditional question/option, formula/variable dependencies, one-question-per-page, section loop, quota/remaining count, and complex question types.
5. Record the exact current output/answer payload for each fixture.
6. Check the GitHub Actions run for the renderer registry change. Then run `npm ci`, production build, and tests locally; record tool versions and outcomes.
7. Add a reproducible bundle analyzer and record initial JS, lazy chunk sizes, and question-type chunk mapping.

## First runtime implementation milestone

Implement only the definition compiler and typed domain model, without changing the current UI:
- immutable survey definition types;
- normalization/validation from API DTOs;
- stable definition IDs and runtime instance IDs;
- expression source collection and compile metadata;
- dependency graph construction;
- deterministic diagnostics for unsupported question types and malformed expressions.

## Then

- Add a full recalculation oracle.
- Add incremental dependency evaluation.
- Add answer state and action handling.
- Add visibility aggregation.
- Add flow/navigation runtime including loop instances.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Measure actual production chunk sizes; dynamic imports are not a substitute for bundle analysis.
