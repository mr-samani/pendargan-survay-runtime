import type { SurveyDefinition } from '../definition/definition.types';
import type { CompiledExpression, CompiledGlobalVariable, SurveyExpressionCompilation } from '../definition/expression.compiler';
import { ExpressionTargetsEnum } from '@service-proxies/models';

export interface LegacyQuestionExecutionStep {
  readonly questionId: string;
  readonly questionSourceId?: string;
  readonly questionIndex: number;
  /** Active global variables owned by this question, preserving API/source order. */
  readonly globalVariableIds: readonly string[];
  /** Question-scoped expressions, preserving API/source order. */
  readonly expressionIds: readonly string[];
  /** Legacy Section and SectionLoop expressions are revisited at every question step. */
  readonly sectionExpressionIds: readonly string[];
  readonly sectionLoopExpressionIds: readonly string[];
  /** FilterDynamicAnswer is a text-template effect, not a boolean action. */
  readonly dynamicFilterExpressionIds: readonly string[];
}

export interface LegacyQuestionExecutionPlan {
  readonly surveyId: string;
  readonly steps: readonly LegacyQuestionExecutionStep[];
  readonly diagnostics: readonly { readonly code: string; readonly path: string; readonly message: string }[];
}

/**
 * Reconstructs the archived runFormula(questionId) walk:
 * answer-state generation -> that question's global variables in source order ->
 * optional answer-state regeneration -> question formulas plus every Section /
 * SectionLoop expression. The caller still uses the dependency graph to enforce
 * data dependencies; this plan captures the legacy question ownership and scope.
 */
export function buildLegacyQuestionExecutionPlan(
  definition: SurveyDefinition,
  compilation: SurveyExpressionCompilation,
): LegacyQuestionExecutionPlan {
  const diagnostics: { code: string; path: string; message: string }[] = [];
  if (definition.id !== compilation.surveyId) {
    return Object.freeze({
      surveyId: definition.id,
      steps: Object.freeze([]),
      diagnostics: Object.freeze([Object.freeze({
        code: 'LEGACY_EXECUTION_PLAN_SURVEY_MISMATCH',
        path: 'surveyId',
        message: 'Definition and expression compilation belong to different surveys.',
      })]),
    });
  }

  const globalVariables = compilation.globalVariables.filter((item) => item.isActive);
  const expressions = compilation.expressions.filter((item) => item.isActive);
  const sectionExpressions = expressions.filter((item) => item.targetType === ExpressionTargetsEnum.Section);
  const sectionLoopExpressions = expressions.filter((item => item.targetType === ExpressionTargetsEnum.SectionLoop));
  const dynamicFilterExpressions = expressions.filter((item) => item.targetType === ExpressionTargetsEnum.FilterDynamicAnswer);

  const steps = definition.questions.map((question, questionIndex) => {
    const ownedVariables = globalVariables.filter((item) =>
      item.formQuestionUniqueId === question.sourceId || item.formQuestionUniqueId === question.id);
    const ownedExpressions = expressions.filter((item) =>
      item.formQuestionUniqueId === question.sourceId || item.formQuestionUniqueId === question.id);

    return Object.freeze({
      questionId: question.id,
      questionSourceId: question.sourceId,
      questionIndex,
      globalVariableIds: Object.freeze(ownedVariables.map((item) => item.id)),
      expressionIds: Object.freeze(ownedExpressions
        .filter((item) => item.targetType !== ExpressionTargetsEnum.Section &&
          item.targetType !== ExpressionTargetsEnum.SectionLoop &&
          item.targetType !== ExpressionTargetsEnum.FilterDynamicAnswer)
        .map((item) => item.id)),
      sectionExpressionIds: Object.freeze(sectionExpressions.map((item) => item.id)),
      sectionLoopExpressionIds: Object.freeze(sectionLoopExpressions.map((item) => item.id)),
      dynamicFilterExpressionIds: Object.freeze(dynamicFilterExpressions
        .filter((item) => item.formQuestionUniqueId === question.sourceId ||
          item.formQuestionUniqueId === question.id)
        .map((item) => item.id)),
    });
  });

  for (const variable of globalVariables) {
    if (!definition.questions.some((question) =>
      variable.formQuestionUniqueId === question.sourceId || variable.formQuestionUniqueId === question.id)) {
      diagnostics.push({
        code: 'LEGACY_GLOBAL_VARIABLE_OWNER_UNRESOLVED',
        path: variable.id,
        message: 'The global variable owner is not present in the question execution order.',
      });
    }
  }

  return Object.freeze({
    surveyId: definition.id,
    steps: Object.freeze(steps),
    diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
  });
}

/** Looks up a source-ordered compiled item list by IDs without changing its order. */
export function selectLegacyExecutionItems<T extends CompiledExpression | CompiledGlobalVariable>(
  items: readonly T[],
  ids: readonly string[],
): readonly T[] {
  const selected = new Set(ids);
  return Object.freeze(items.filter((item) => selected.has(item.id)));
}
