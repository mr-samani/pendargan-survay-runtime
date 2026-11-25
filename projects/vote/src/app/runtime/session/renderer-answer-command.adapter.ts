import type { SurveyDefinition } from '../definition/definition.types';
import type { AnswerCommand } from '../state/answer-state.types';
import type { RendererAnswerChange } from '../../questions/shared/question-runtime-event-bus';

export interface RendererAnswerCommandCompilation {
  readonly commands: readonly AnswerCommand[];
  readonly diagnostics: readonly { readonly code: string; readonly path: string; readonly message: string }[];
}

/** Resolve renderer API references to canonical immutable definition IDs. */
export function compileRendererAnswerChange(
  definition: SurveyDefinition,
  instanceId: string,
  change: RendererAnswerChange,
): RendererAnswerCommandCompilation {
  const question = resolveUnique(definition.questions, change.questionRef,
    (item) => [item.id, item.uniqueIdPerForm, item.sourceId]);
  if (!question) return failure('RENDERER_QUESTION_REFERENCE_UNRESOLVED', 'questionRef',
    'The renderer question reference is missing, unknown, or ambiguous in this survey definition.');

  if (change.kind === 'matrix-cells') {
    const resolved = change.optionRefs.map((reference) => resolveUnique(question.options, reference,
      (item) => [item.id, item.uniqueIdPerForm, item.sourceId]));
    if (resolved.some((option) => !option)) {
      return failure('RENDERER_OPTION_REFERENCE_UNRESOLVED', 'optionRefs',
        'At least one matrix column reference is missing, unknown, or ambiguous.');
    }
    const optionIds = resolved.map((option) => option!.id);
    if (new Set(optionIds).size !== optionIds.length) {
      return failure('RENDERER_OPTION_REFERENCE_DUPLICATED', 'optionRefs',
        'A matrix row cannot submit the same column more than once.');
    }
    return Object.freeze({
      commands: Object.freeze([
        { type: 'set-selected-options' as const, instanceId, questionId: question.id,
          optionIds: Object.freeze(optionIds) },
        { type: 'set-value' as const, instanceId, questionId: question.id, value: change.value },
      ]),
      diagnostics: Object.freeze([]),
    });
  }

  if (change.kind === 'question-value') {
    return Object.freeze({
      commands: Object.freeze([{
        type: 'set-value' as const,
        instanceId,
        questionId: question.id,
        value: change.value,
      }]),
      diagnostics: Object.freeze([]),
    });
  }

  if (change.kind === 'single-choice') {
    const option = resolveUnique(question.options, change.optionRef,
      (item) => [item.id, item.uniqueIdPerForm, item.sourceId]);
    if (!option) return failure('RENDERER_OPTION_REFERENCE_UNRESOLVED', 'optionRef',
      'The renderer option reference is missing, unknown, or ambiguous for this question.');
    return Object.freeze({
      commands: Object.freeze([{
        type: 'set-selected-options' as const, instanceId, questionId: question.id,
        optionIds: Object.freeze([option.id]),
      }]),
      diagnostics: Object.freeze([]),
    });
  }

  const resolved = change.optionRefs.map((reference) => resolveUnique(question.options, reference,
    (item) => [item.id, item.uniqueIdPerForm, item.sourceId]));
  if (resolved.some((option) => !option)) {
    return failure('RENDERER_OPTION_REFERENCE_UNRESOLVED', 'optionRefs',
      'At least one renderer option reference is missing, unknown, or ambiguous for this question.');
  }
  const optionIds = resolved.map((option) => option!.id);
  if (new Set(optionIds).size !== optionIds.length) {
    return failure('RENDERER_OPTION_REFERENCE_DUPLICATED', 'optionRefs',
      'A renderer cannot submit the same selected option more than once.');
  }
  return Object.freeze({
    commands: Object.freeze([{
      type: 'set-selected-options' as const, instanceId, questionId: question.id,
      optionIds: Object.freeze(optionIds),
    }]),
    diagnostics: Object.freeze([]),
  });
}

function resolveUnique<T>(items: readonly T[], reference: string,
  keys: (item: T) => readonly (string | undefined)[]): T | undefined {
  if (!reference) return undefined;
  const matches = items.filter((item) => keys(item).some((key) => key === reference));
  return matches.length === 1 ? matches[0] : undefined;
}

function failure(code: string, path: string, message: string): RendererAnswerCommandCompilation {
  return Object.freeze({
    commands: Object.freeze([]),
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}
