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

export interface ActionResolutionIndexes {
  readonly questionByReference: ReadonlyMap<string, SurveyQuestionDefinition>;
  readonly optionByQuestion: WeakMap<SurveyQuestionDefinition, ReadonlyMap<string, string>>;
}

// Survey definitions are immutable for a session. Cache their lookup indexes so
// each action transaction does not rescan every question and option.
const actionResolutionIndexCache = new WeakMap<SurveyDefinition, ActionResolutionIndexes>();

function getActionResolutionIndexes(definition: SurveyDefinition): ActionResolutionIndexes {
  const cached = actionResolutionIndexCache.get(definition);
  if (cached) return cached;

  const questionByReference = new Map<string, SurveyQuestionDefinition>();
  const optionByQuestion = new WeakMap<SurveyQuestionDefinition, ReadonlyMap<string, string>>();

  for (const question of definition.questions) {
    for (const reference of [question.sourceId, question.uniqueIdPerForm, question.id]) {
      if (reference && !questionByReference.has(reference)) {
        questionByReference.set(reference, question);
      }
    }

    const optionByReference = new Map<string, string>();
    for (const option of question.options) {
      for (const reference of [option.uniqueIdPerForm, option.sourceId, option.id]) {
        if (typeof reference === 'string' && !optionByReference.has(reference)) {
          optionByReference.set(reference, option.id);
        }
      }
    }
    optionByQuestion.set(question, optionByReference);
  }

  const indexes = Object.freeze({ questionByReference, optionByQuestion });
  actionResolutionIndexCache.set(definition, indexes);
  return indexes;
}

interface SurveyActionResolution {
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
  const indexes = getActionResolutionIndexes(definition);
  const requested = new Map<string, {
    question: SurveyQuestionDefinition;
    optionId: string;
    selectConditions: boolean[];
    unselectConditions: boolean[];
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

    const question = action.formQuestionUniqueId
      ? indexes.questionByReference.get(action.formQuestionUniqueId)
      : undefined;
    if (!question) {
      diagnostics.push({
        code: 'ACTION_QUESTION_UNRESOLVED',
        severity: 'error',
        path: action.expressionId,
        message: 'The Select/UnSelect action question could not be resolved.',
      });
      continue;
    }
    const optionId = typeof action.targetKey === 'string'
      ? indexes.optionByQuestion.get(question)?.get(action.targetKey)
      : undefined;
    if (optionId === undefined) {
      diagnostics.push({
        code: 'ACTION_OPTION_UNRESOLVED',
        severity: 'error',
        path: action.expressionId,
        message: 'The Select/UnSelect action option could not be resolved.',
      });
      continue;
    }

    const key = question.id + '\u0000' + optionId;
    let target = requested.get(key);
    if (!target) {
      target = { question, optionId, selectConditions: [], unselectConditions: [] };
      requested.set(key, target);
    }
    const conditions = action.actionType === ExpressionActionsEnum.Select
      ? target.selectConditions
      : target.unselectConditions;
    conditions.push(action.conditionMet);
  }

  const commands: AnswerCommand[] = [];
  const conflictPolicy = options.conflictPolicy ?? 'reject';

  for (const [key, target] of requested) {
    const selectRequested = target.selectConditions.length > 0 &&
      target.selectConditions.every(Boolean);
    const unselectRequested = target.unselectConditions.length > 0 &&
      target.unselectConditions.every(Boolean);
    if (!selectRequested && !unselectRequested) continue;

    let selected: boolean;
    if (selectRequested && !unselectRequested) selected = true;
    else if (unselectRequested && !selectRequested) selected = false;
    else {
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
            path: target.question.id + '.' + target.optionId,
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
