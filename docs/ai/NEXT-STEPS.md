# Next steps

Work in this order. Do not skip discovery and jump directly into a broad rewrite.

## Immediate

1. Verify every API question enum ID against available production renderer implementations; the checked-in repository currently contains only three renderer folders.
2. Trace all answer mutation and save/submit paths, including temporary saves, loop payloads, payment and file upload.
3. Create anonymized fixtures for representative surveys: simple selection, multi-select, conditional question/option, formula/variable dependencies, one-question-per-page, section loop, quota/remaining count, and complex question types.
4. Record exact legacy answer payloads for each fixture.
5. Confirm the published `ngx-exp-parser@^1.0.2` artifact before using new bytecode/dependency-analysis APIs.
6. Run CI on the immutable definition compiler and fix any build/test issues before marking CORE-001/002 complete.

## First runtime implementation milestone

The initial immutable definition layer is implemented:
- typed definitions for sections, questions, options, expressions, and global variables;
- API DTO normalization into a detached immutable snapshot;
- deterministic ordering and structural diagnostics;
- generated service-proxy DTOs remain untouched.

Next, implement expression source compilation and dependency metadata from the compiled definition. Keep evaluation separate from parsing/compilation.

## Then

- Build a typed dependency graph and cycle diagnostics.
- Add a full recalculation oracle.
- Add incremental dependency evaluation.
- Add answer state and action handling.
- Add visibility aggregation.
- Add flow/navigation runtime including loop instances.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Measure actual production chunk sizes; dynamic imports are not a substitute for bundle analysis.
