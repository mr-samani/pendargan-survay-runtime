import type { SurveyGlobalVariableDefinition } from '../definition/definition.types';
import {
  replaceLegacyFormulaValues,
  type LegacyFormulaDiagnostic,
} from './legacy-formula-compatibility';

export interface LegacyGlobalVariablePlan extends Pick<
  SurveyGlobalVariableDefinition,
  'id' | 'title' | 'expression' | 'formQuestionUniqueId' | 'isActive'
> {
  /** Tokens produced by the legacy cleanUpFormula + splitFormulaBySpace pipeline. */
  readonly variables: readonly string[];
  readonly previousResult?: unknown;
}

export interface LegacyGlobalVariableResult {
  readonly id: string;
  readonly title: string;
  readonly result: unknown;
  readonly changed: boolean;
}

export interface LegacyGlobalVariableEvaluation {
  readonly answerStates: Readonly<Record<string, unknown>>;
  readonly evaluated: readonly LegacyGlobalVariableResult[];
  readonly diagnostics: readonly LegacyFormulaDiagnostic[];
}

/**
 * Evaluates only the global variables owned by one legacy question, in source order.
 *
 * The evaluator is injected so the runtime can use ngx-exp-parser without importing
 * the old unsafe evaluator. The caller supplies already-normalized expressions and
 * dependency tokens from the verified legacy preprocessing boundary.
 */
export function evaluateLegacyGlobalVariablesForQuestion(
  questionSourceId: string,
  plans: readonly LegacyGlobalVariablePlan[],
  initialAnswerStates: Readonly<Record<string, unknown>>,
  evaluate: (expression: string) => unknown,
): LegacyGlobalVariableEvaluation {
  const answerStates: Record<string, unknown> = Object.assign(Object.create(null), initialAnswerStates);
  const evaluated: LegacyGlobalVariableResult[] = [];
  const diagnostics: LegacyFormulaDiagnostic[] = [];

  for (const plan of plans) {
    if (!plan.isActive || plan.formQuestionUniqueId !== questionSourceId) continue;

    const replaced = replaceLegacyFormulaValues(
      plan.expression,
      plan.variables,
      answerStates,
    );

    if (replaced.missingVariables.length) {
      diagnostics.push({
        code: 'LEGACY_GLOBAL_VARIABLE_DEPENDENCY_MISSING',
        path: plan.id,
        message: 'Missing answer-state variables were replaced with null: ' +
          replaced.missingVariables.join(', ') + '.',
      });
    }

    let result: unknown;
    let succeeded = false;
    try {
      result = evaluate(replaced.formula);
      succeeded = true;
    } catch (error) {
      result = false;
      diagnostics.push({
        code: 'LEGACY_GLOBAL_VARIABLE_EVALUATION_FAILED',
        path: plan.id,
        message: error instanceof Error ? error.message : 'Global-variable evaluation failed.',
      });
    }

    const changed = !Object.is(plan.previousResult, result);
    evaluated.push(Object.freeze({
      id: plan.id,
      title: plan.title,
      result,
      changed,
    }));

    // The archived implementation only published a global variable after a
    // successful evaluation, and always published it as a quoted string here.
    if (succeeded) {
      answerStates['[%'+ plan.title + '%]'] = JSON.stringify(String(result));
    }
  }

  return Object.freeze({
    answerStates: Object.freeze(answerStates),
    evaluated: Object.freeze(evaluated),
    diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
  });
}


export interface LegacyQueryParameterValue {
  readonly title: string;
  readonly result: unknown;
}

/**
 * Adds query-string values only when no configured global variable has the same
 * normalized title. The normalizer is injected because the archived code runs
 * cleanUpFormula on both the query key and value before storing them.
 */
export function appendLegacyQueryParameterValues(
  existing: readonly { readonly title: string; readonly result?: unknown }[],
  queryParameters: Readonly<Record<string, string>>,
  normalize: (value: string) => string,
): readonly LegacyQueryParameterValue[] {
  const result: LegacyQueryParameterValue[] = existing.map((item) => ({
    title: item.title,
    result: item.result,
  }));
  const titles = new Set(existing.map((item) => item.title));

  for (const [rawTitle, rawValue] of Object.entries(queryParameters)) {
    const title = normalize(rawTitle);
    if (titles.has(title)) continue;
    result.push(Object.freeze({ title, result: normalize(rawValue) }));
    titles.add(title);
  }

  return Object.freeze(result);
}

/** Converts successful results to the formula replacement format used by expressions. */
export function toLegacyGlobalVariableExpressionValues(
  evaluated: readonly LegacyGlobalVariableResult[],
): readonly { readonly title: string; readonly result: unknown }[] {
  return Object.freeze(evaluated.map((item) => Object.freeze({
    title: item.title,
    result: item.result,
  })));
}
