# Next steps

Work in this order. Do not skip discovery and jump directly into a broad rewrite.

## Immediate

1. Verify every API question enum ID against available production renderer implementations; the checked-in repository currently contains only three renderer folders.
2. Trace all answer mutation and save/submit paths, including temporary saves, loop payloads, payment and file upload.
3. Create anonymized fixtures for representative surveys: simple selection, multi-select, conditional question/option, formula/variable dependencies, one-question-per-page, section loop, quota/remaining count, and complex question types.
4. Record exact legacy answer payloads for each fixture.
5. Confirm the published `ngx-exp-parser@^1.0.2` artifact before using new bytecode/dependency-analysis APIs.
6. The immutable definition compiler passed production build and all 12 unit tests in CI. CORE-001/002 are complete.

## Next runtime implementation milestone

Implement expression compilation from the immutable definition:
- collect active and inactive expression records without losing original metadata;
- parse expression source once and retain diagnostics;
- map expression references to stable runtime definition IDs;
- build dependency metadata using only APIs confirmed in the installed/published `ngx-exp-parser` package;
- explicitly separate pure formula nodes from side-effect actions.

Do not evaluate actions from Angular computed signals. Keep the definition snapshot immutable and keep mutable runtime values in a separate store.

## Then

- Build a typed dependency graph and cycle diagnostics.
- Add a full recalculation oracle.
- Add incremental dependency evaluation.
- Add answer state and action handling.
- Add visibility aggregation.
- Add flow/navigation runtime including loop instances.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Measure actual production chunk sizes; dynamic imports are not a substitute for bundle analysis.
