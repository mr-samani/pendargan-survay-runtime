# Formula scope contract

The runtime exposes a structured, immutable formula scope through
`createSurveyFormulaScope` in `session/formula-scope.ts`.

## Namespaced shape

- `survey`: survey identity and form GUID.
- `runtime`: active answer instance and repeated-section coordinates.
- `loop.variables`: variables captured for the active loop iteration only.
- `answers.byQuestionId`, `answers.byQuestionUniqueIdPerForm`, and
  `answers.byQuestionSourceId`: answer values, selected option IDs, resolved
  selected-option metadata, and dirty state.
- `questions.byId`, `questions.byUniqueIdPerForm`, and
  `questions.bySourceId`: stable question metadata indexes.

The indexes are separate to prevent an identifier from one namespace from
silently shadowing another. Duplicate keys inside one namespace throw instead
of producing an ambiguous formula scope. All projected records and arrays are
frozen; nested answer values are detached before exposure.

## Compatibility boundary

This is an explicit new scope contract, **not** a declaration that legacy
expression aliases are compatible. The first source-driven reverse-engineering
pass is recorded in [LEGACY-FORMULA-COMPATIBILITY.md](./LEGACY-FORMULA-COMPATIBILITY.md).
It documents the old flat `answerStates` token families, substitution order,
missing-token behavior, `ExpEvaluator` functions, and question-owned global
variable execution. The separate `createLegacyFormulaAnswerStates` adapter now projects the verified legacy flat token contract from one immutable answer instance. Its explicit inputs and current limitations are documented in [LEGACY-FORMULA-COMPATIBILITY.md](./LEGACY-FORMULA-COMPATIBILITY.md). It is not yet wired as the production evaluator scope; the separate global-variable and side-effect helpers now include a pure per-instance effect-batch planner but are not yet dispatched by the session controller; per-instance previous-result/override persistence, the real matrix payload shape, and evaluator parity remain open. The standalone legacy custom-function library is implemented, but a direct function-valued reactive scope did not work with the installed parser and was removed; parser registration/integration remains a separate task.

Use it with the existing evaluator adapter:

```ts
createSurveyFormulaEvaluator(engine, createSurveyFormulaScopeFactory)
```

Loop-local variables are sourced from the active iteration context supplied by
the session. The factory does not merge them into global engine variables and
does not mutate answer state.
