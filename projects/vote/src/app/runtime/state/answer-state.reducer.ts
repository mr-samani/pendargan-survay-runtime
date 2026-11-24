import type { SurveyDefinition } from '../definition/definition.types';
import type {
  AnswerCommand,
  AnswerCommandResult,
  AnswerStateDiagnostic,
  AnswerStateSnapshot,
  AnswerValue,
  QuestionAnswerState,
} from './answer-state.types';

const DEFAULT_INSTANCE_ID = 'root';

export function createInitialAnswerState(
  definition: SurveyDefinition,
  instanceId = DEFAULT_INSTANCE_ID,
): AnswerStateSnapshot {
  if (!instanceId.trim()) throw new Error('Answer instance ID is required.');

  const answers: Record<string, QuestionAnswerState> = {};
  for (const question of definition.questions) {
    answers[question.id] = createEmptyAnswer(question.id, 0);
  }

  return freezeSnapshot({
    surveyId: definition.id,
    revision: 0,
    instances: { [instanceId]: answers },
  });
}

/**
 * Creates a separate answer namespace for a repeated section/runtime instance.
 * Loop traversal and instance-ID generation are intentionally owned by FlowRuntime.
 */
export function addAnswerInstance(
  state: AnswerStateSnapshot,
  definition: SurveyDefinition,
  instanceId: string,
  questionIds: readonly string[],
): AnswerCommandResult {
  if (state.surveyId !== definition.id) {
    return failure(state, 'ANSWER_STATE_SURVEY_MISMATCH', 'surveyId',
      'Answer state and definition belong to different surveys.');
  }
  if (!instanceId.trim()) {
    return failure(state, 'ANSWER_INSTANCE_ID_REQUIRED', 'instanceId',
      'An answer instance ID is required.');
  }
  if (Object.prototype.hasOwnProperty.call(state.instances, instanceId)) {
    return failure(state, 'ANSWER_INSTANCE_ALREADY_EXISTS', instanceId,
      'An answer instance with this ID already exists.');
  }

  const knownQuestions = new Map(definition.questions.map((question) => [question.id, question]));
  const answers: Record<string, QuestionAnswerState> = {};
  const diagnostics: AnswerStateDiagnostic[] = [];

  for (const questionId of questionIds) {
    if (!knownQuestions.has(questionId)) {
      diagnostics.push({
        code: 'ANSWER_QUESTION_UNKNOWN',
        severity: 'error',
        path: instanceId + '.' + questionId,
        message: 'The question does not exist in this survey definition.',
      });
      continue;
    }
    answers[questionId] = createEmptyAnswer(questionId, state.revision + 1);
  }

  if (diagnostics.length) return failureWithDiagnostics(state, diagnostics);

  const next: AnswerStateSnapshot = {
    surveyId: state.surveyId,
    revision: state.revision + 1,
    instances: {
      ...state.instances,
      [instanceId]: answers,
    },
  };

  return freezeCommandResult(next, true, [], []);
}

/**
 * Applies one batch atomically. Any invalid command rejects the entire batch.
 * Option order is normalized to definition order, not click order.
 */
export function applyAnswerCommands(
  definition: SurveyDefinition,
  state: AnswerStateSnapshot,
  commands: readonly AnswerCommand[],
): AnswerCommandResult {
  if (state.surveyId !== definition.id) {
    return failure(state, 'ANSWER_STATE_SURVEY_MISMATCH', 'surveyId',
      'Answer state and definition belong to different surveys.');
  }
  if (!commands.length) return freezeCommandResult(state, true, [], []);

  const questions = new Map(definition.questions.map((question) => [question.id, question]));
  const nextInstances: Record<string, Record<string, QuestionAnswerState>> = {};
  for (const [instanceId, answers] of Object.entries(state.instances)) {
    nextInstances[instanceId] = { ...answers };
  }

  const diagnostics: AnswerStateDiagnostic[] = [];
  const changed = new Map<string, { instanceId: string; questionId: string }>();
  const nextRevision = state.revision + 1;

  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    const path = 'commands[' + index + ']';
    const instance = nextInstances[command.instanceId];
    if (!instance) {
      diagnostics.push({
        code: 'ANSWER_INSTANCE_UNKNOWN',
        severity: 'error',
        path: path + '.instanceId',
        message: 'The answer instance does not exist.',
      });
      continue;
    }

    const current = instance[command.questionId];
    const question = questions.get(command.questionId);
    if (!current || !question) {
      diagnostics.push({
        code: 'ANSWER_QUESTION_NOT_IN_INSTANCE',
        severity: 'error',
        path: path + '.questionId',
        message: 'The question is not part of this answer instance.',
      });
      continue;
    }

    let nextAnswer: QuestionAnswerState | undefined;

    switch (command.type) {
      case 'set-value': {
        try {
          const value = cloneAndFreezeAnswerValue(command.value);
          if (!answerValueEquals(current.value, value)) {
            nextAnswer = { ...current, value };
          }
        } catch (error) {
          diagnostics.push({
            code: 'ANSWER_VALUE_NOT_JSON_SAFE',
            severity: 'error',
            path: path + '.value',
            message: error instanceof Error ? error.message : 'Answer value is not JSON-safe.',
          });
        }
        break;
      }

      case 'set-selected-options': {
        const allowed = new Set(question.options.map((option) => option.id));
        const unknown = command.optionIds.filter((id) => !allowed.has(id));
        if (unknown.length) {
          diagnostics.push({
            code: 'ANSWER_OPTION_UNKNOWN',
            severity: 'error',
            path: path + '.optionIds',
            message: 'Unknown option IDs: ' + [...new Set(unknown)].join(', ') + '.',
          });
          break;
        }

        const selected = new Set(command.optionIds);
        const optionIds = question.options
          .filter((option) => selected.has(option.id))
          .map((option) => option.id);
        if (!stringArraysEqual(current.selectedOptionIds, optionIds)) {
          nextAnswer = { ...current, selectedOptionIds: optionIds };
        }
        break;
      }

      case 'toggle-option': {
        if (!question.options.some((option) => option.id === command.optionId)) {
          diagnostics.push({
            code: 'ANSWER_OPTION_UNKNOWN',
            severity: 'error',
            path: path + '.optionId',
            message: 'The option does not belong to this question.',
          });
          break;
        }

        const selected = new Set(current.selectedOptionIds);
        if (command.selected) selected.add(command.optionId);
        else selected.delete(command.optionId);
        const optionIds = question.options
          .filter((option) => selected.has(option.id))
          .map((option) => option.id);
        if (!stringArraysEqual(current.selectedOptionIds, optionIds)) {
          nextAnswer = { ...current, selectedOptionIds: optionIds };
        }
        break;
      }

      case 'clear': {
        if (current.value !== null || current.selectedOptionIds.length > 0) {
          nextAnswer = { ...current, value: null, selectedOptionIds: [] };
        }
        break;
      }
    }

    if (nextAnswer) {
      instance[command.questionId] = {
        ...nextAnswer,
        isDirty: true,
        updatedAtRevision: nextRevision,
      };
      changed.set(command.instanceId + '\u0000' + command.questionId, {
        instanceId: command.instanceId,
        questionId: command.questionId,
      });
    }
  }

  if (diagnostics.length) return failureWithDiagnostics(state, diagnostics);
  if (!changed.size) return freezeCommandResult(state, true, [], []);

  const next: AnswerStateSnapshot = {
    surveyId: state.surveyId,
    revision: nextRevision,
    instances: nextInstances,
  };
  return freezeCommandResult(next, true, [...changed.values()], []);
}


/**
 * Hydrates an existing answer instance from trusted server restore projections.
 * Unlike interactive commands, restored answers remain clean and preserve server option order.
 */
export function hydrateAnswerInstance(
  definition: SurveyDefinition,
  state: AnswerStateSnapshot,
  instanceId: string,
  restoredAnswers: readonly Pick<QuestionAnswerState,
    'questionId' | 'value' | 'selectedOptionIds' | 'shouldClearEditableInitialValue'>[],
): AnswerCommandResult {
  if (state.surveyId !== definition.id) {
    return failure(state, 'ANSWER_STATE_SURVEY_MISMATCH', 'surveyId',
      'Answer state and definition belong to different surveys.');
  }
  const currentInstance = state.instances[instanceId];
  if (!currentInstance) {
    return failure(state, 'ANSWER_INSTANCE_UNKNOWN', instanceId,
      'The answer instance does not exist.');
  }
  if (!restoredAnswers.length) return freezeCommandResult(state, true, [], []);

  const questions = new Map(definition.questions.map((question) => [question.id, question]));
  const diagnostics: AnswerStateDiagnostic[] = [];
  const seen = new Set<string>();
  const nextAnswers = { ...currentInstance };
  const changed: { instanceId: string; questionId: string }[] = [];
  const nextRevision = state.revision + 1;

  for (let index = 0; index < restoredAnswers.length; index++) {
    const restored = restoredAnswers[index];
    const path = 'restoredAnswers[' + index + ']';
    const question = questions.get(restored.questionId);
    if (!question || !currentInstance[restored.questionId]) {
      diagnostics.push({
        code: 'RESTORE_QUESTION_NOT_IN_INSTANCE',
        severity: 'error',
        path: path + '.questionId',
        message: 'The restored question does not belong to this answer instance.',
      });
      continue;
    }
    if (seen.has(restored.questionId)) {
      diagnostics.push({
        code: 'RESTORE_QUESTION_DUPLICATED',
        severity: 'error',
        path: path + '.questionId',
        message: 'A question can only be restored once per answer instance.',
      });
      continue;
    }
    seen.add(restored.questionId);
    const allowed = new Set(question.options.map((option) => option.id));
    const unknown = restored.selectedOptionIds.filter((id) => !allowed.has(id));
    if (unknown.length) {
      diagnostics.push({
        code: 'RESTORE_OPTION_NOT_IN_DEFINITION',
        severity: 'error',
        path: path + '.selectedOptionIds',
        message: 'Unknown option IDs: ' + [...new Set(unknown)].join(', ') + '.',
      });
      continue;
    }
    try {
      nextAnswers[restored.questionId] = Object.freeze({
        questionId: restored.questionId,
        value: cloneAndFreezeAnswerValue(restored.value),
        selectedOptionIds: Object.freeze([...restored.selectedOptionIds]),
        isDirty: false,
        shouldClearEditableInitialValue: restored.shouldClearEditableInitialValue ?? false,
        updatedAtRevision: nextRevision,
      });
      changed.push({ instanceId, questionId: restored.questionId });
    } catch (error) {
      diagnostics.push({
        code: 'RESTORE_ANSWER_VALUE_NOT_JSON_SAFE',
        severity: 'error',
        path: path + '.value',
        message: error instanceof Error ? error.message : 'Restored answer is not JSON-safe.',
      });
    }
  }

  if (diagnostics.length) return failureWithDiagnostics(state, diagnostics);
  if (!changed.length) return freezeCommandResult(state, true, [], []);
  const next: AnswerStateSnapshot = {
    surveyId: state.surveyId,
    revision: nextRevision,
    instances: { ...state.instances, [instanceId]: nextAnswers },
  };
  return freezeCommandResult(next, true, changed, []);
}

export function getQuestionAnswer(
  state: AnswerStateSnapshot,
  instanceId: string,
  questionId: string,
): QuestionAnswerState | undefined {
  return state.instances[instanceId]?.[questionId];
}

function createEmptyAnswer(questionId: string, revision: number): QuestionAnswerState {
  return {
    questionId,
    value: null,
    selectedOptionIds: [],
    isDirty: false,
    updatedAtRevision: revision,
  };
}

function cloneAndFreezeAnswerValue(value: AnswerValue): AnswerValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Answer numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreezeAnswerValue(item)));
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('Answer objects must be plain JSON objects.');
    }
    const clone: Record<string, AnswerValue> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = cloneAndFreezeAnswerValue(item);
    }
    return Object.freeze(clone);
  }
  throw new Error('Answer value must be JSON-safe.');
}

function answerValueEquals(left: AnswerValue, right: AnswerValue): boolean {
  const stack: [AnswerValue, AnswerValue][] = [[left, right]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (Object.is(a, b)) continue;
    if (typeof a !== typeof b || a === null || b === null) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let index = 0; index < a.length; index++) stack.push([a[index], b[index]]);
      continue;
    }

    if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const aObject = a as Readonly<Record<string, AnswerValue>>;
      const bObject = b as Readonly<Record<string, AnswerValue>>;
      const aKeys = Object.keys(aObject);
      const bKeys = Object.keys(bObject);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (!Object.prototype.hasOwnProperty.call(bObject, key)) return false;
        stack.push([aObject[key], bObject[key]]);
      }
      continue;
    }

    return false;
  }
  return true;
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function failure(
  state: AnswerStateSnapshot,
  code: string,
  path: string,
  message: string,
): AnswerCommandResult {
  return failureWithDiagnostics(state, [{ code, severity: 'error', path, message }]);
}

function failureWithDiagnostics(
  state: AnswerStateSnapshot,
  diagnostics: readonly AnswerStateDiagnostic[],
): AnswerCommandResult {
  return freezeCommandResult(state, false, [], diagnostics);
}

function freezeCommandResult(
  state: AnswerStateSnapshot,
  applied: boolean,
  changedAnswers: readonly { readonly instanceId: string; readonly questionId: string }[],
  diagnostics: readonly AnswerStateDiagnostic[],
): AnswerCommandResult {
  const frozenState = freezeSnapshot(state);
  for (const diagnostic of diagnostics) Object.freeze(diagnostic);
  for (const item of changedAnswers) Object.freeze(item);
  Object.freeze(changedAnswers);
  Object.freeze(diagnostics);
  return Object.freeze({ state: frozenState, applied, changedAnswers, diagnostics });
}

function freezeSnapshot(state: AnswerStateSnapshot): AnswerStateSnapshot {
  for (const answers of Object.values(state.instances)) {
    for (const answer of Object.values(answers)) {
      Object.freeze(answer.selectedOptionIds);
      Object.freeze(answer);
    }
    Object.freeze(answers);
  }
  Object.freeze(state.instances);
  return Object.freeze(state);
}
