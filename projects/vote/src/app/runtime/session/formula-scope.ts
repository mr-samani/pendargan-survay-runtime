import type { SurveyFormulaEvaluationContext, SurveyFormulaScopeFactory } from './concrete-runtime-projector';
import type { AnswerValue, QuestionAnswerState } from '../state/answer-state.types';
import type { SurveyQuestionDefinition, SurveyOptionDefinition } from '../definition/definition.types';

export interface SurveyFormulaAnswerValue {
  readonly value: AnswerValue;
  readonly selectedOptionIds: readonly string[];
  readonly selectedOptions: readonly {
    readonly id: string;
    readonly uniqueIdPerForm?: string;
    readonly sourceId?: string;
    readonly title?: string | null;
    readonly rowNumber?: number;
    readonly point?: number;
  }[];
  readonly isDirty: boolean;
}

export interface SurveyFormulaQuestionMetadata {
  readonly id: string;
  readonly sourceId?: string;
  readonly uniqueIdPerForm?: string;
  readonly questionType?: SurveyQuestionDefinition['questionType'];
  readonly formSectionUniqueId?: string;
  readonly title?: string | null;
  readonly isActive: boolean;
  readonly isRequired: boolean;
}

const questionMetadataCache = new WeakMap<SurveyQuestionDefinition, SurveyFormulaQuestionMetadata>();
const optionIndicesCache = new WeakMap<readonly SurveyOptionDefinition[], ReadonlyMap<string, readonly number[]>>();

export interface SurveyFormulaScope {
  readonly survey: {
    readonly id: string;
    readonly formGuid?: string;
  };
  readonly runtime: {
    readonly instanceId: string;
    readonly isRepeated: boolean;
    readonly sectionId?: string;
    readonly iterationIndex?: number;
    readonly backendLoopNumber?: number;
  };
  readonly loop: {
    readonly variables: Readonly<Record<string, string>>;
  };
  readonly answers: {
    readonly byQuestionId: Readonly<Record<string, SurveyFormulaAnswerValue>>;
    readonly byQuestionUniqueIdPerForm: Readonly<Record<string, SurveyFormulaAnswerValue>>;
    readonly byQuestionSourceId: Readonly<Record<string, SurveyFormulaAnswerValue>>;
  };
  readonly questions: {
    readonly byId: Readonly<Record<string, SurveyFormulaQuestionMetadata>>;
    readonly byUniqueIdPerForm: Readonly<Record<string, SurveyFormulaQuestionMetadata>>;
    readonly bySourceId: Readonly<Record<string, SurveyFormulaQuestionMetadata>>;
  };
}

/**
 * Creates a namespaced, immutable formula scope from one runtime answer instance.
 *
 * This is the new runtime scope contract, not a claim of legacy formula-alias parity.
 * Legacy aliases must be added only after they are verified against the original
 * logic service and real production expressions.
 */
export function createSurveyFormulaScope(
  context: SurveyFormulaEvaluationContext,
): SurveyFormulaScope {
  const instance = context.answers.instances[context.instanceId];
  if (!instance) {
    throw new Error('Formula scope cannot be created for unknown answer instance: ' + context.instanceId);
  }

  const loop = findLoopContext(context);
  const byQuestionId: Record<string, SurveyFormulaAnswerValue> = Object.create(null);
  const byQuestionUniqueIdPerForm: Record<string, SurveyFormulaAnswerValue> = Object.create(null);
  const byQuestionSourceId: Record<string, SurveyFormulaAnswerValue> = Object.create(null);
  const byId: Record<string, SurveyFormulaQuestionMetadata> = Object.create(null);
  const byUniqueIdPerForm: Record<string, SurveyFormulaQuestionMetadata> = Object.create(null);
  const bySourceId: Record<string, SurveyFormulaQuestionMetadata> = Object.create(null);

  for (const question of context.definition.questions) {
    const answer = instance[question.id];
    if (answer) {
      const projectedAnswer = projectAnswer(answer, question.options);
      assignUnique(byQuestionId, question.id, projectedAnswer, 'question id');
      assignOptionalUnique(byQuestionUniqueIdPerForm, question.uniqueIdPerForm, projectedAnswer, 'question uniqueIdPerForm');
      assignOptionalUnique(byQuestionSourceId, question.sourceId, projectedAnswer, 'question sourceId');
    }

    const metadata = projectQuestionMetadata(question);
    assignUnique(byId, question.id, metadata, 'question id');
    assignOptionalUnique(byUniqueIdPerForm, question.uniqueIdPerForm, metadata, 'question uniqueIdPerForm');
    assignOptionalUnique(bySourceId, question.sourceId, metadata, 'question sourceId');
  }

  return deepFreeze({
    survey: {
      id: context.definition.id,
      formGuid: context.definition.formGuid,
    },
    runtime: {
      instanceId: context.instanceId,
      isRepeated: loop !== undefined,
      sectionId: loop?.sectionId,
      iterationIndex: loop?.iterationIndex,
      backendLoopNumber: loop?.backendLoopNumber,
    },
    loop: {
      variables: cloneStringRecord(context.loopVariables),
    },
    answers: {
      byQuestionId,
      byQuestionUniqueIdPerForm,
      byQuestionSourceId,
    },
    questions: {
      byId,
      byUniqueIdPerForm,
      bySourceId,
    },
  }) as SurveyFormulaScope;
}

/** Ready-to-use factory for createSurveyFormulaEvaluator. */
export const createSurveyFormulaScopeFactory: SurveyFormulaScopeFactory = createSurveyFormulaScope;

function findLoopContext(
  context: SurveyFormulaEvaluationContext,
): { sectionId: string; iterationIndex: number; backendLoopNumber: number } | undefined {
  for (const section of Object.values(context.loops.sections)) {
    const iteration = section.iterations.find((item) =>
      item.answerInstanceId === context.instanceId &&
      item.iterationIndex === section.currentIterationIndex,
    );
    if (iteration) {
      return {
        sectionId: section.sectionId,
        iterationIndex: iteration.iterationIndex,
        backendLoopNumber: iteration.backendLoopNumber,
      };
    }
  }
  return undefined;
}

function projectAnswer(
  answer: QuestionAnswerState,
  options: readonly SurveyOptionDefinition[],
): SurveyFormulaAnswerValue {
  const optionIndices = getOptionIndices(options);
  const selectedIndices = new Set<number>();
  for (const selectedId of answer.selectedOptionIds) {
    for (const index of optionIndices.get(selectedId) ?? []) selectedIndices.add(index);
  }
  const orderedSelectedIndices = [...selectedIndices].sort((left, right) => left - right);
  return {
    // AnswerStateSnapshot values and option definitions are already deeply
    // immutable. Reuse them instead of recursively cloning every answer on
    // every formula-scope rebuild.
    value: answer.value,
    selectedOptionIds: answer.selectedOptionIds,
    // Resolve only selected IDs, then restore definition order. The immutable
    // option index is cached by the definition-owned options array.
    selectedOptions: Object.freeze(orderedSelectedIndices.map((index) => options[index])),
    isDirty: answer.isDirty,
  };
}

function projectQuestionMetadata(question: SurveyQuestionDefinition): SurveyFormulaQuestionMetadata {
  const cached = questionMetadataCache.get(question);
  if (cached) return cached;
  const metadata = Object.freeze({
    id: question.id,
    sourceId: question.sourceId,
    uniqueIdPerForm: question.uniqueIdPerForm,
    questionType: question.questionType,
    formSectionUniqueId: question.formSectionUniqueId,
    title: question.title,
    isActive: question.isActive,
    isRequired: question.isRequired,
  });
  questionMetadataCache.set(question, metadata);
  return metadata;
}

function getOptionIndices(
  options: readonly SurveyOptionDefinition[],
): ReadonlyMap<string, readonly number[]> {
  const cached = optionIndicesCache.get(options);
  if (cached) return cached;
  const mutable = new Map<string, number[]>();
  for (let index = 0; index < options.length; index++) {
    const id = options[index].id;
    const indices = mutable.get(id);
    if (indices) indices.push(index);
    else mutable.set(id, [index]);
  }
  const index = new Map<string, readonly number[]>();
  for (const [id, indices] of mutable) index.set(id, Object.freeze(indices));
  optionIndicesCache.set(options, index);
  return index;
}

function assignUnique<T>(target: Record<string, T>, key: string, value: T, label: string): void {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    throw new Error('Ambiguous formula scope key for ' + label + ': ' + key);
  }
  target[key] = value;
}

function assignOptionalUnique<T>(
  target: Record<string, T>,
  key: string | undefined,
  value: T,
  label: string,
): void {
  if (key) assignUnique(target, key, value, label);
}

function cloneStringRecord(source: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const target: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(source)) target[key] = value;
  return Object.freeze(target);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
