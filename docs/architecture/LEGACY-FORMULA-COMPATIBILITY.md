# Legacy Formula Compatibility Contract

This document records behavior verified directly in `PREVIUOS_SOURCE`. It is a compatibility specification for the rewrite, not a recommendation to preserve unsafe implementation details.

Primary sources:
- `PREVIUOS_SOURCE/app/vote/services/logic.service.ts`
- `PREVIUOS_SOURCE/app/vote/helpers/expression-evaluator.ts`
- `PREVIUOS_SOURCE/app/vote/helpers/formula.helper.ts`
- `PREVIUOS_SOURCE/core/models/QuestionModel.ts`
- `PREVIUOS_SOURCE/core/models/AnswerModel.ts`

## 1. Formula execution pipeline

The legacy runtime performs these operations:

1. `initializeFormula` keeps active expressions, runs `cleanUpFormula`, clears cached result fields, and derives a whitespace-separated dependency/token list with `splitFormulaBySpace`.
2. `initializeGlobalVariables` keeps active global variables except the obsolete `system_initialvalue_dynamicanswer_` prefix, normalizes their expressions the same way, and builds the same token list. Query-string parameters are appended as system variables only when no variable with that title already exists.
3. On answer changes, `runFormula` walks questions from the changed question forward. For each question it generates answer-state tokens, evaluates global variables owned by that question, regenerates answer-state tokens when a global variable changes, then evaluates expressions associated with that question. Section and SectionLoop expressions are considered at each question.
4. When an expression result changes, the runtime applies its view/action effect and can revisit the preceding question. During initialization, the walk continues through the full question list.
5. Global-variable values are substituted into expression text before answer-state tokens are substituted.

This ordering matters. The old implementation is question-order-sensitive; it does not simply evaluate every global variable once in an unordered pass.

## 2. Legacy answer-state token contract

Question and option identifiers used in formula tokens are their `uniqueIdPerForm` values with hyphens removed. In the tables below, `Q` is followed by the question fid and `A` by the option fid.

| Question kind | Token(s) produced | Verified value semantics |
| --- | --- | --- |
| UniqueSelect, Dropdown, Matrix, Matrix_radio, Emoji, UniqueSelectWithImageOptions | `Q{q}.A{a}`, `Q{q}.AnswerTitle`, `Q{q}.Point`, `Q{q}.PointWeigth`, `Q{q}.SelectedCount`, `Q{q}.AnswersCount` | Each option token is boolean. A selected option contributes its title and point. `PointWeigth` is point multiplied by question grade. Counts exclude hidden options; selected state also excludes a hidden question. |
| MultiSelect, MultiSelectWithImageOptions, Matrix_checkbox, HasPriority | Same choice tokens | Selected titles are joined with comma-space; points are summed; weighted points are total points multiplied by question grade. |
| SkuCount | `Q{q}.Sum` | Sum of `total` across the answer array; zero when there is no answer array. |
| Matrix_MultiNumeric | `Q{q}.A{a}.Number` | Visible row value converted to number; missing visible row value is null. |
| Matrix_MultiShortText | `Q{q}.A{a}.Text` | Visible row text; missing visible row value is null. |
| ShortText, LongText, Date, Time, Email, Mobile, NationalCode, Phone, PostalCode, CustomMaskShortText | `Q{q}.Text` | Quoted answer text, or an empty quoted string when the question is hidden. |
| PointQuestion, Rating, NPS | `Q{q}.Point` | Numeric answer, falling back to zero. |
| Numeric, Point_NumericScale | `Q{q}.Number`, `Q{q}.AnswerTitle` | Numeric answer, falling back to zero; AnswerTitle is empty in this branch. |
| DynamicAnswer, RetailAudit, SkuCount_Dynamic, Chart | `{{Q{q}.Record.Data.{field}}}` | Each dynamic field namespace is registered as a placeholder whose replacement value is `{field}.Value`; this is used by dynamic-data filter expressions. |
| RecordsOtherForms | `Q{q}.Data.{field}` | Values are copied from `answer.jsonValuesDictionary`; numeric fields are converted to numbers, other fields are quoted strings. |
| Captcha | `Q{q}.Valid` | Current answer, falling back to false. |

A region token is always initialized: `Region.UniqueId` is the last region child identifier with hyphens removed and quoted, or an empty quoted string.

The legacy implementation writes these values into a single flat `answerStates` dictionary. It does not create a per-question object graph. The rewrite must preserve the token contract at the formula-engine boundary while keeping its internal answer state typed and isolated by runtime instance.

## 3. Token substitution details

- `splitFormulaBySpace` splits on spaces and removes one leading `@` or `#` from each token.
- Tokens wrapped as `[%name%]` and `{{name}}` are substituted as-is.
- Other tokens are substituted using an `@name` marker in the normalized formula.
- A missing answer-state token is first inserted into the legacy dictionary with value `null`; the formula receives the literal replacement `null`.
- Global variables use the `[%title%]` syntax. Their replacement is case-insensitive and happens before answer-state replacement.
- A string global-variable result is wrapped in double quotes; non-string results are inserted as scalar values.
- The legacy `replaceReplaceAllFunction` ignores its `ignore` argument and constructs a global regular expression from the token after escaping regex metacharacters.

There is a compatibility edge worth preserving as an explicit test: dependency token normalization strips both `@` and `#`, while the ordinary-token replacement branch constructs an `@` marker. Do not silently assume that every historical `#` token follows the same path.

## 4. Expression evaluator behavior

The legacy evaluator is `ExpEvaluator` backed by `mathjs`.

Registered custom functions:
- `random(max, key)`: deterministic per key for the lifetime of one evaluator instance; the first call chooses an integer from zero through max (inclusive). A missing key, non-numeric max, or negative max throws a typed error.
- `endsWith(a, b)`, `startsWith(a, b)`, `contains(a, b)`: both arguments must be strings.
- `avgWeakData(neutralNum, value1, weight1, ...)`: requires an even number of value/weight parameters after the neutral threshold; values at or below the threshold are excluded; result is rounded to two decimals; zero is returned when no weight remains.

The mathjs instance overrides equality and inequality with JavaScript loose equality (`==` and `!=`).

When `AppConsts.expressionCaseSensitive` is false, the old implementation uses `new Function` with the custom functions plus `Math` and `Date`. Otherwise it removes `math.` prefixes, converts `!` to `not`, `&&` to `and`, and `||` to `or`, then evaluates through mathjs. The dynamic-function branch is legacy behavior only and must not be copied into the rewrite; it is an unsafe-eval/CSP incompatibility.

## 5. Expression and action semantics verified in LogicService

- Formula results must be strictly boolean for ordinary actions. A non-boolean result is treated as an error; the formula result becomes false.
- Evaluation errors also set the formula result to false.
- `calculateFormulas(questionId)` selects active expressions owned by that question, plus all Section and SectionLoop target expressions.
- `updateFormView` applies only active InsideForm expressions whose result has changed.
- Question/Answer Show actions invert the formula result before assigning the hidden state. Hide actions use the result directly.
- Section Show assigns `dontShow = !result`; Section Hide assigns `dontShow = result`.
- SectionLoop assigns `hasLoop = result` on the section whose `uniqueIdPerForm` matches `targetKey`.
- Answer Select/UnSelect actions have additional selection and disabled-state side effects; they are not equivalent to visibility projection.

## 6. Global-variable ownership and ordering

- A global variable is recalculated by `calculateGvars(question)` only when its `formQuestionUniqueId` equals that question's `uniqueId`.
- The variable's expression is resolved against the current flat answer-state dictionary and evaluated by the same evaluator.
- A changed global-variable result sets `resultUpdated` and updates matching initial values and secondary dynamic filters.
- A global variable is also published into answer state under `[%title%]`, with the result wrapped as a quoted string in the legacy implementation.
- Query parameters are only added when their normalized title does not already exist in the global-variable list.

The new dependency graph may optimize evaluation, but it must prove equivalence for question ownership, dependencies, evaluation order, missing values, and global-variable aliases before replacing this behavior.

## 7. Rewrite parity gaps

The current structured `createSurveyFormulaScope` is intentionally not yet a legacy-compatible formula scope. It exposes typed answer values and identity indexes, but it does not yet emit the flat tokens above, reproduce legacy token preprocessing, model region/demography/system fields, or guarantee legacy global-variable ownership and ordering.

Before enabling it as the production formula scope, add golden tests for every token family above and differential tests for the evaluator semantics. Unsupported token families must produce explicit diagnostics rather than silently evaluating as missing values.
