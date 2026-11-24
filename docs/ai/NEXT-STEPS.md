# Next steps

Work in this order. Do not skip discovery and jump directly into a broad rewrite.

## Immediate

1. Verify every API question enum ID against available production renderer implementations; the checked-in repository currently contains only three renderer folders.
2. Trace all answer mutation and save/submit paths, including temporary saves, loop payloads, payment and file upload.
3. Create anonymized fixtures for representative surveys: simple selection, multi-select, conditional question/option, formula/variable dependencies, one-question-per-page, section loop, quota/remaining count, and complex question types.
4. Record exact legacy answer payloads for each fixture.
5. The lockfile pins `ngx-exp-parser@1.0.2`; CI verified that the installed package exposes `ExpressionAnalyzer`.
6. Run CI for the expression compiler. CORE-001/002 are already green; CORE-003 remains pending until its own CI run passes.

## Runtime implementation

The immutable definition and expression-registration layers are implemented:
- typed definitions for sections, questions, options, expressions, and global variables;
- API DTO normalization into a detached immutable snapshot;
- deterministic ordering and structural diagnostics;
- expression registration through the installed FormulaEngineService;
- dependency and volatility metadata copied into an immutable result;
- no expression evaluation or action execution during compilation.

Next, implement the typed dependency graph and cycle diagnostics. Keep pure formula nodes separate from side-effect action nodes.

## Then

- Add a full-recalculation oracle.
- Add incremental dependency evaluation.
- Add answer state and action handling.
- Add visibility aggregation.
- Add flow/navigation runtime including loop instances.
- Migrate question types incrementally behind the typed lazy renderer registry.
- Measure actual production chunk sizes; dynamic imports are not a substitute for bundle analysis.
