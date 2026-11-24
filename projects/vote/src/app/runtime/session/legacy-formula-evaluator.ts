import type { FormulaEngineService } from 'ngx-exp-parser';
import {
  replaceLegacyFormulaPipeline,
  type LegacyFormulaDiagnostic,
} from './legacy-formula-compatibility';
import {
  createLegacyFormulaFunctions,
  normalizeLegacyMathJsExpression,
} from './legacy-formula-functions';

export interface LegacyFormulaEvaluationResult {
  readonly success: boolean;
  readonly value?: unknown;
  readonly error?: string;
  readonly missingVariables: readonly string[];
  readonly diagnostics: readonly LegacyFormulaDiagnostic[];
}

export interface LegacyFormulaEvaluator {
  evaluateValue(
    formula: string,
    variables: readonly string[],
    answerStates: Readonly<Record<string, unknown>>,
    globalVariables?: readonly { readonly title: string; readonly result: unknown }[],
    additionalScope?: Readonly<Record<string, unknown>>,
  ): LegacyFormulaEvaluationResult;
  evaluateBoolean(
    formula: string,
    variables: readonly string[],
    answerStates: Readonly<Record<string, unknown>>,
    globalVariables?: readonly { readonly title: string; readonly result: unknown }[],
    additionalScope?: Readonly<Record<string, unknown>>,
  ): LegacyFormulaEvaluationResult;
}

/**
 * Adapts the verified legacy token pipeline to ngx-exp-parser.
 *
 * The returned evaluator owns one random(key) cache, matching one archived
 * ExpEvaluator instance. Every call gets a fresh parser scope so one survey or
 * answer instance cannot leak local scope values into another evaluation.
 */
export function createLegacyFormulaEvaluator(
  engine: Pick<FormulaEngineService, 'evaluateExpression' | 'createReactiveModel'>,
  randomSource: () => number = Math.random,
): LegacyFormulaEvaluator {
  const functions = createLegacyFormulaFunctions(randomSource);

  const evaluateValue = (
    formula: string,
    variables: readonly string[],
    answerStates: Readonly<Record<string, unknown>>,
    globalVariables: readonly { readonly title: string; readonly result: unknown }[] = [],
    additionalScope: Readonly<Record<string, unknown>> = {},
  ): LegacyFormulaEvaluationResult => {
    const replacement = replaceLegacyFormulaPipeline(
      formula,
      variables,
      answerStates,
      globalVariables,
    );
    try {
      const scope = engine.createReactiveModel({
        ...functions,
        ...additionalScope,
      });
      const expression = normalizeLegacyMathJsExpression(replacement.formula);
      const result = engine.evaluateExpression(expression, scope);
      return Object.freeze({
        success: result.success,
        value: result.value,
        error: result.error,
        missingVariables: replacement.missingVariables,
        diagnostics: Object.freeze([]),
      });
    } catch (error) {
      return Object.freeze({
        success: false,
        error: error instanceof Error ? error.message : 'Formula evaluation failed.',
        missingVariables: replacement.missingVariables,
        diagnostics: Object.freeze([]),
      });
    }
  };

  const evaluateBoolean = (
    formula: string,
    variables: readonly string[],
    answerStates: Readonly<Record<string, unknown>>,
    globalVariables: readonly { readonly title: string; readonly result: unknown }[] = [],
    additionalScope: Readonly<Record<string, unknown>> = {},
  ): LegacyFormulaEvaluationResult => {
    const result = evaluateValue(
      formula, variables, answerStates, globalVariables, additionalScope,
    );
    if (!result.success) return result;
    if (typeof result.value !== 'boolean') {
      return Object.freeze({
        success: false,
        value: false,
        error: 'Invalid',
        missingVariables: result.missingVariables,
        diagnostics: Object.freeze([]),
      });
    }
    return result;
  };

  return Object.freeze({ evaluateValue, evaluateBoolean });
}
