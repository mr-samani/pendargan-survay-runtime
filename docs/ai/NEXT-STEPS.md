# Next steps

Work in this order. Do not skip discovery and jump directly into a broad rewrite.

## Immediate

1. Confirm repository visibility is intentional; it is currently public.
2. Obtain/verify the complete source snapshot and identify any omitted runtime files. The current repository contains the vote client subset checked into this branch.
3. Inspect the full response DTOs, section DTOs, answer DTOs, expression action/target enums, and all submission/save code.
4. Create anonymized fixtures for representative surveys: simple selection, multi-select, conditional question/option, formula/variable dependencies, one-question-per-page, section loop, quota/remaining count, and complex question types.
5. Record the exact current output/answer payload for each fixture.
6. Run `npm ci`, production build, and tests in a real Node environment; record results and tool versions.
7. Add a reproducible bundle analyzer and record initial JS, lazy chunk sizes, and question-type chunk mapping.

## First implementation milestone

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
- Introduce the renderer registry and dynamic imports behind a compatibility adapter.
- Migrate question types incrementally, with parity tests per type.
