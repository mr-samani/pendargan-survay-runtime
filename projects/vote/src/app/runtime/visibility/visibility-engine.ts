import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
} from '@service-proxies/models';
import type {
  DefinitionDiagnostic,
  SurveyDefinition,
  SurveyQuestionDefinition,
} from '../definition/definition.types';
import type {
  CompiledExpression,
  SurveyExpressionCompilation,
} from '../definition/expression.compiler';
import type {
  ProposedSurveyAction,
  SurveyFullEvaluationResult,
} from '../definition/full-evaluator';

export type VisibilityValue = boolean | null;

export interface OptionVisibility {
  readonly optionId: string;
  readonly isVisible: VisibilityValue;
}
export interface QuestionVisibility {
  readonly questionId: string;
  readonly isVisible: VisibilityValue;
  readonly options: readonly OptionVisibility[];
}
export interface SectionVisibility {
  readonly sectionId: string;
  readonly isVisible: VisibilityValue;
  readonly questionIds: readonly string[];
}
export interface VisibilityResolutionOptions {
  readonly emptySectionVisibility?: 'visible' | 'hidden';
}
export interface SurveyVisibilityResult {
  readonly surveyId: string;
  readonly questions: readonly QuestionVisibility[];
  readonly sections: readonly SectionVisibility[];
  readonly unhandledActions: readonly ProposedSurveyAction[];
  readonly diagnostics: readonly DefinitionDiagnostic[];
  readonly isValid: boolean;
}
interface ConditionGroup {
  readonly show: boolean[];
  readonly hide: boolean[];
  showUnknown: boolean;
  hideUnknown: boolean;
}
interface ResolvedTarget {
  readonly kind: 'question' | 'option';
  readonly question: SurveyQuestionDefinition;
  readonly optionId?: string;
}

/**
 * Pure projection for the legacy InsideForm Question/Answer Show/Hide subset.
 * It never mutates the definition, answer state, or renderer objects.
 */
export function resolveSurveyVisibility(
  definition: SurveyDefinition,
  expressions: SurveyExpressionCompilation,
  evaluation: SurveyFullEvaluationResult,
  options: VisibilityResolutionOptions = {},
): SurveyVisibilityResult {
  const diagnostics: DefinitionDiagnostic[] = [...evaluation.diagnostics];
  const questionGroups = new Map<string, ConditionGroup>();
  const optionGroups = new Map<string, ConditionGroup>();
  const actions = new Map(evaluation.proposedActions.map((item) => [item.expressionId, item]));
  const consumed = new Set<string>();
  const unhandled = new Map<string, ProposedSurveyAction>();

  for (const question of definition.questions) {
    questionGroups.set(question.id, createGroup());
    for (const option of question.options) optionGroups.set(option.id, createGroup());
  }

  for (const expression of expressions.expressions) {
    if (!expression.isActive ||
      (expression.actionType !== ExpressionActionsEnum.Show &&
       expression.actionType !== ExpressionActionsEnum.Hide)) continue;

    const action = actions.get(expression.id);
    if (expression.formExpressionType !== FormExpressionTypeEnum.InsideForm) {
      if (action) unhandled.set(action.expressionId, action);
      diagnostic(diagnostics, 'VISIBILITY_SCOPE_UNSUPPORTED', 'warning', expression.id,
        'Only InsideForm visibility expressions are currently resolved.');
      continue;
    }

    const target = resolveTarget(definition, expression);
    if (!target) {
      if (action) unhandled.set(action.expressionId, action);
      diagnostic(diagnostics, 'VISIBILITY_TARGET_UNRESOLVED', 'error', expression.id,
        'The visibility expression target could not be resolved against this definition.');
      continue;
    }

    const group = target.kind === 'question'
      ? questionGroups.get(target.question.id)!
      : optionGroups.get(target.optionId!)!;

    if (!action) {
      if (expression.actionType === ExpressionActionsEnum.Show) group.showUnknown = true;
      else group.hideUnknown = true;
      const result = expression.formulaId
        ? evaluation.formulaResults.find((item) => item.formulaId === expression.formulaId)
        : undefined;
      diagnostic(diagnostics, 'VISIBILITY_CONDITION_UNAVAILABLE', 'error', expression.id,
        result?.error ?? 'The active visibility expression has no successful evaluation result.');
      continue;
    }

    consumed.add(action.expressionId);
    if (action.actionType === ExpressionActionsEnum.Show) group.show.push(action.conditionMet);
    else group.hide.push(action.conditionMet);
  }

  for (const action of evaluation.proposedActions) {
    if (!consumed.has(action.expressionId)) unhandled.set(action.expressionId, action);
  }

  const questions: QuestionVisibility[] = definition.questions.map((question) => {
    const own = question.isActive ? resolveGroup(questionGroups.get(question.id)!) : false;
    const optionsResult: OptionVisibility[] = question.options.map((option) => ({
      optionId: option.id,
      isVisible: question.isActive && option.source['isActive'] !== false
        ? resolveGroup(optionGroups.get(option.id)!)
        : false,
    }));
    const anyOption = optionsResult.length
      ? combineAny(optionsResult.map((item) => item.isVisible))
      : true;
    return {
      questionId: question.id,
      isVisible: question.isActive ? combineAnd(own, anyOption) : false,
      options: optionsResult,
    };
  });

  const visibilityByQuestion = new Map(questions.map((item) => [item.questionId, item.isVisible]));
  const emptyVisible = options.emptySectionVisibility !== 'hidden';
  const sections: SectionVisibility[] = definition.sections.map((section) => {
    const members = definition.questions.filter((question) =>
      question.formSectionUniqueId === section.uniqueIdPerForm ||
      question.formSectionUniqueId === section.sourceId ||
      question.formSectionUniqueId === section.id);
    const questionIds = members.map((question) => question.id);
    const visible = members.length
      ? combineAny(members.map((question) => visibilityByQuestion.get(question.id) ?? null))
      : emptyVisible;
    return {
      sectionId: section.id,
      questionIds,
      isVisible: section.source['isActive'] === false ? false : visible,
    };
  });

  return freezeResult({
    surveyId: definition.id,
    questions,
    sections,
    unhandledActions: [...unhandled.values()],
    diagnostics,
    isValid: !diagnostics.some((item) => item.severity === 'error'),
  });
}

function resolveTarget(
  definition: SurveyDefinition,
  expression: CompiledExpression,
): ResolvedTarget | undefined {
  const question = definition.questions.find((item) =>
    item.sourceId === expression.formQuestionUniqueId ||
    item.uniqueIdPerForm === expression.formQuestionUniqueId ||
    item.id === expression.formQuestionUniqueId);
  if (!question) return undefined;
  if (expression.targetType === ExpressionTargetsEnum.Question) {
    return { kind: 'question', question };
  }
  if (expression.targetType === ExpressionTargetsEnum.Answer) {
    const option = question.options.find((item) =>
      item.uniqueIdPerForm === expression.targetKey || item.id === expression.targetKey);
    return option ? { kind: 'option', question, optionId: option.id } : undefined;
  }
  return undefined;
}

function createGroup(): ConditionGroup {
  return { show: [], hide: [], showUnknown: false, hideUnknown: false };
}
function resolveGroup(group: ConditionGroup): VisibilityValue {
  const show = resolveConjunction(group.show, group.showUnknown, true);
  const hide = resolveConjunction(group.hide, group.hideUnknown, false);
  if (show === false || hide === true) return false;
  if (show === true && hide === false) return true;
  return null;
}
function resolveConjunction(values: readonly boolean[], unknown: boolean, fallback: boolean): VisibilityValue {
  if (values.some((value) => !value)) return false;
  if (unknown) return null;
  return values.length ? true : fallback;
}
function combineAnd(a: VisibilityValue, b: VisibilityValue): VisibilityValue {
  if (a === false || b === false) return false;
  if (a === true && b === true) return true;
  return null;
}
function combineAny(values: readonly VisibilityValue[]): VisibilityValue {
  if (values.some((value) => value === true)) return true;
  if (values.every((value) => value === false)) return false;
  return null;
}
function diagnostic(
  list: DefinitionDiagnostic[], code: string, severity: 'warning' | 'error', path: string, message: string,
): void {
  list.push({ code, severity, path, message });
}
function freezeResult(value: SurveyVisibilityResult): SurveyVisibilityResult {
  for (const question of value.questions) {
    for (const option of question.options) Object.freeze(option);
    Object.freeze(question.options);
    Object.freeze(question);
  }
  for (const section of value.sections) {
    Object.freeze(section.questionIds);
    Object.freeze(section);
  }
  for (const action of value.unhandledActions) Object.freeze(action);
  for (const item of value.diagnostics) Object.freeze(item);
  Object.freeze(value.questions);
  Object.freeze(value.sections);
  Object.freeze(value.unhandledActions);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
