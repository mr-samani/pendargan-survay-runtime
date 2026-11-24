import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { ProposedSurveyAction } from '../definition/full-evaluator';
import { applyAnswerCommands } from '../state/answer-state.reducer';
import type {
  AnswerCommand,
  AnswerCommandResult,
  AnswerStateSnapshot,
} from '../state/answer-state.types';

export type ActionConflictPolicy = 'reject' | 'select-wins' | 'unselect-wins';

export interface SurveyActionResolutionOptions {
  /** Defaults to reject: the runtime never guesses which conflicting action wins. */
  readonly conflictPolicy?: ActionConflictPolicy;
}

export interface SurveyActionDiagnostic {
  readonly code: string;
  readonly severity: 'warning' | 'error';
  readonly path: string;
  readonly message: string;
}

export interface SurveyActionResolution {
  readonly surveyId: string;
  readonly instanceId: string;
  readonly commands: readonly AnswerCommand[];
  readonly unhandledActions: readonly ProposedSurveyAction[];
  readonly diagnostics: readonly SurveyActionDiagnostic[];
  readonly isValid: boolean;
}

export interface SurveyActionTransactionResult {
  readonly resolution: SurveyActionResolution;
  readonly answerResult: AnswerCommandResult;
}

/**
 * Converts supported Select/UnSelect proposals into answer-state commands.
 * Conflicts are resolved only by an explicit policy; default behavior is reject.
 */
export function resolveSurveyActions(
  definition: SurveyDefinition,
  instanceId: string,
  actions: readonly ProposedSurveyAction[],
  options: SurveyActionResolutionOptions = {},
): SurveyActionResolution {
  const diagnostics: SurveyActionDiagnostic[] = [];
  const unhandled = new Map<string, ProposedSurveyAction>();
  const requested = new Map<string, {
    question: SurveyQuestionDefinition;
    optionId: string;
    selections: Set<boolean>;
    sourceActions: ProposedSurveyAction[];
  }>();

  if (!instanceId.trim()) {
    diagnostics.push({
      code: 'ACTION_INSTANCE_ID_REQUIRED',
      severity: 'error',
      path: 'instanceId',
      message: 'An answer instance ID is required to apply question actions.',
    });
  }

  for (const action of actions) {
    if (action.actionType !== ExpressionActionsEnum.Select &&
        action.actionType !== ExpressionActionsEnum.UnSelect) {
      unhandled.set(action.expressionId, action);
      continue;
    }
    if (action.formExpressionType !== FormExpressionTypeEnum.InsideForm ||
        action.targetType !== ExpressionTargetsEnum.Answer) {
      unhandled.set(action.expressionId, action);
      continue;
    }

    const question = resolveQuestion(definition, action.formQuestionUniqueId);
    if (!question) {
      diagnostics.push({
        code: 'ACTION_QUESTION_UNRESOLVED',
        severity: 'error',
        path: action.expressionId,
        message: 'The Select/UnSelect action question could not be resolved.',
      });
      continue;
    }
    const option = question.options.find((item) =>
      item.uniqueIdPerForm === action.targetKey || item.id === action.targetKey);
    if (!option) {
      diagnostics.push({
        code: 'ACTION_OPTION_UNRESOLVED',
        severity: 'error',
        path: action.expressionId,
        message: 'The Select/UnSelect action option could not be resolved.',
      });
      continue;
    }

    const key = question.id + '\u0000' + option.id;
    let target = requested.get(key);
    if (!target) {
      target = { question, optionId: option.id, selections: new Set<boolean>(), sourceActions: [] };
      requested.set(key, target);
    }
    target.sourceActions.push(action);
    if (action.conditionMet) {
      target.selections.add(action.actionType === ExpressionActionsEnum.Select);
    }
  }

  const commands: AnswerCommand[] = [];
  const conflictPolicy = options.conflictPolicy ?? 'reject';

  for (const [key, target] of requested) {
    if (target.selections.size === 0) continue;
    let selected: boolean;
    if (target.selections.size === 1) {
      selected = target.selections.values().next().value!;
    } else {
      switch (conflictPolicy) {
        case 'select-wins':
          selected = true;
          break;
        case 'unselect-wins':
          selected = false;
          break;
        default:
          diagnostics.push({
            code: 'ACTION_TARGET_CONFLICT',
            severity: 'error',
            path: key.replace('\u0000', '.'),
            message: 'Select and UnSelect both target this option in one transaction; no implicit precedence is applied.',
          });
          continue;
      }
    }
    commands.push({
      type: 'toggle-option',
      instanceId,
      questionId: target.question.id,
      optionId: target.optionId,
      selected,
    });
  }

  return freezeResolution({
    surveyId: definition.id,
    instanceId,
    commands,
    unhandledActions: [...unhandled.values()],
    diagnostics,
    isValid: !diagnostics.some((item) => item.severity === 'error'),
  });
}

/** Resolves proposals and atomically applies supported commands to answer state. */
export function applySurveyActionTransaction(
  definition: SurveyDefinition,
  state: AnswerStateSnapshot,
  instanceId: string,
  actions: readonly ProposedSurveyAction[],
  options: SurveyActionResolutionOptions = {},
): SurveyActionTransactionResult {
  const resolution = resolveSurveyActions(definition, instanceId, actions, options);
  const answerResult = resolution.isValid
    ? applyAnswerCommands(definition, state, resolution.commands)
    : rejectedAnswerResult(state, resolution.diagnostics);
  return Object.freeze({ resolution, answerResult });
}

function resolveQuestion(
  definition: SurveyDefinition,
  questionReference: string | null | undefined,
): SurveyQuestionDefinition | undefined {
  if (!questionReference) return undefined;
  return definition.questions.find((question) =>
    question.sourceId === questionReference ||
    question.uniqueIdPerForm === questionReference ||
    question.id === questionReference);
}

function rejectedAnswerResult(
  state: AnswerStateSnapshot,
  diagnostics: readonly SurveyActionDiagnostic[],
): AnswerCommandResult {
  const answerDiagnostics = diagnostics
    .filter((item) => item.severity === 'error')
    .map((item) => ({
      code: item.code,
      severity: 'error' as const,
      path: item.path,
      message: item.message,
    }));
  return Object.freeze({
    state,
    applied: false,
    changedAnswers: Object.freeze([]),
    diagnostics: Object.freeze(answerDiagnostics),
  });
}

function freezeResolution(value: SurveyActionResolution): SurveyActionResolution {
  for (const command of value.commands) Object.freeze(command);
  for (const action of value.unhandledActions) Object.freeze(action);
  for (const diagnostic of value.diagnostics) Object.freeze(diagnostic);
  Object.freeze(value.commands);
  Object.freeze(value.unhandledActions);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
