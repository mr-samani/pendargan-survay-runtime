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
expression aliases are compatible. The legacy alias mapping, missing-value
semantics, global-variable precedence, and parser property-access behavior
must still be verified against the original logic service and actual production
expressions before the factory is used as the default production scope.

Use it with the existing evaluator adapter:

```ts
createSurveyFormulaEvaluator(engine, createSurveyFormulaScopeFactory)
```

Loop-local variables are sourced from the active iteration context supplied by
the session. The factory does not merge them into global engine variables and
does not mutate answer state.
