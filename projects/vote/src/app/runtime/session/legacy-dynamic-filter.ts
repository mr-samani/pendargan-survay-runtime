import type { SurveyDefinition, SurveyGlobalVariableDefinition } from '../definition/definition.types';
import type {
  EvaluatedDynamicFilterTemplate,
  EvaluatedGlobalVariable,
  FormulaExecutionResult,
} from '../definition/full-evaluator';
import { replaceLegacyFormulaPipeline, splitLegacyFormulaVariables } from './legacy-formula-compatibility';

export interface LegacyDynamicFilterUpdate {
  readonly expressionId: string;
  readonly questionId: string;
  readonly value: string;
}

export interface LegacyDynamicFilterResolution {
  readonly updates: readonly LegacyDynamicFilterUpdate[];
  readonly diagnostics: readonly { readonly code: string; readonly path: string; readonly message: string }[];
}

/**
 * Resolves the archived FilterDynamicAnswer path as text substitution, never as
 * expression evaluation. The target is the question whose uniqueIdPerForm is the
 * expression targetKey, matching LogicService.calculateFormulas.
 */
export function resolveLegacyDynamicFilterTemplates(
  definition: SurveyDefinition,
  templates: readonly EvaluatedDynamicFilterTemplate[],
  answerStates: Readonly<Record<string, unknown>>,
  evaluatedGlobalVariables: readonly EvaluatedGlobalVariable[],
  formulaResults: readonly FormulaExecutionResult[],
  globalVariableDefinitions: readonly SurveyGlobalVariableDefinition[],
): LegacyDynamicFilterResolution {
  const updates: LegacyDynamicFilterUpdate[] = [];
  const diagnostics: { code: string; path: string; message: string }[] = [];
  const globalValues = globalVariableDefinitions.filter((item) => item.isActive).map((variable) => {
    const evaluated = evaluatedGlobalVariables.find((item) => item.id === variable.id);
    const failed = formulaResults.some((item) =>
      item.kind === 'global-variable' && item.sourceId === variable.id && !item.success);
    return {
      title: variable.title,
      result: evaluated?.value ?? (failed ? false : undefined),
    };
  });

  for (const template of templates) {
    if (!template.targetKey) {
      diagnostics.push({
        code: 'DYNAMIC_FILTER_TARGET_MISSING',
        path: template.expressionId,
        message: 'The dynamic-answer filter has no target question key.',
      });
      continue;
    }

    const targets = definition.questions.filter((question =>
      question.uniqueIdPerForm === template.targetKey));
    if (targets.length !== 1) {
      diagnostics.push({
        code: targets.length ? 'DYNAMIC_FILTER_TARGET_AMBIGUOUS' : 'DYNAMIC_FILTER_TARGET_UNRESOLVED',
        path: template.expressionId,
        message: targets.length
          ? 'The dynamic-answer filter target key matches more than one question.'
          : 'No question matches the dynamic-answer filter target key.',
      });
      continue;
    }

    const variables = splitLegacyFormulaVariables(template.expressionText);
    const replaced = replaceLegacyFormulaPipeline(
      template.expressionText,
      variables,
      answerStates,
      globalValues,
    );
    if (replaced.missingVariables.length) {
      diagnostics.push({
        code: 'DYNAMIC_FILTER_REFERENCE_MISSING',
        path: template.expressionId,
        message: 'Missing answer-state references were replaced with null: ' +
          replaced.missingVariables.join(', ') + '.',
      });
    }

    updates.push(Object.freeze({
      expressionId: template.expressionId,
      questionId: targets[0].id,
      value: replaced.formula,
    }));
  }

  return Object.freeze({
    updates: Object.freeze(updates),
    diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
  });
}
