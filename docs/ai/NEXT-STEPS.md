# Next steps

Work in this order. Do not skip discovery and jump directly into a broad rewrite.

## Immediate discovery

1. Verify every API question enum ID against available production renderer implementations; the checked-in repository currently contains only three renderer folders.
2. Trace all answer mutation and save/submit paths, including temporary saves, loop payloads, payment and file upload.
3. Create anonymized fixtures for representative surveys: simple selection, multi-select, conditional question/option, formula/variable dependencies, one-question-per-page, section loop, quota/remaining count, and complex question types.
4. Record exact legacy answer payloads for each fixture.
5. Keep the installed `ngx-exp-parser@1.0.2` compatibility check; CI verifies that its public artifact exposes `ExpressionAnalyzer`.

## Next runtime milestone — typed dependency graph

The definition and expression-registration layers are implemented and validated. Build the runtime dependency graph from the compiled metadata:
- use typed node identities for inputs, global variables, expressions and action targets;
- resolve variable references to global-variable nodes;
- resolve question/entity references only after confirming the exact legacy entity-ID mapping;
- preserve dynamic-index dependencies as wildcard edges rather than inventing concrete property paths;
- detect missing references and cycles with diagnostics;
- keep side-effect action nodes separate from pure formula nodes.

Do not execute Show/Hide/Select/UnSelect while building the graph. Graph construction must be deterministic and independent of Angular rendering.

## Then

- Add a full-recalculation oracle.
- Add incremental dependency evaluation.
- Add answer state and action handling.
- Add visibility aggregation.
- Add flow/navigation runtime including loop instances.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Measure actual production chunk sizes; dynamic imports are not a substitute for bundle analysis.
