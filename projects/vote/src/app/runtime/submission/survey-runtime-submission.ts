import {
  ExpressionActionsEnum,
  RepeatedFormSectionDto,
  VoterAnswerDetailListAndSectionIdDto,
  type CreateVoterAnswerDetailDto,
} from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import { setSurveyLoopIterationFilled } from '../flow/loop-runtime';
import type { SurveyLoopIteration, SurveyLoopRuntimeSnapshot } from '../flow/loop-runtime';
import { serializeQuestionAnswer, type QuestionAnswerSerializationContext } from './question-answer-serializer';
import type { LoopSubmissionProjection } from '../flow/loop-submission-serializer';
import { buildCreateVoterWithDetailsDto, type SubmissionPayloadBuildResult, type SurveySubmissionMetadata } from './submission-payload-builder';
import type { SurveyRuntimeSessionSnapshot } from '../session/runtime-session';
import type { AnswerStateSnapshot } from '../state/answer-state.types';

export interface RuntimeSubmissionOptions {
  readonly serializeQuestion?: (
    question: SurveyQuestionDefinition,
    answer: NonNullable<AnswerStateSnapshot['instances'][string][string]>,
    context: QuestionAnswerSerializationContext & {
      readonly sectionId: string;
      readonly iteration: SurveyLoopIteration;
      readonly answerInstanceId: string;
    },
  ) => readonly CreateVoterAnswerDetailDto[];
}

export interface PaymentPartialSaveGuardResult {
  readonly allowed: boolean;
  readonly paymentQuestionId?: string;
  readonly invalidPreviousQuestionIds: readonly string[];
  readonly unknownPreviousQuestionIds: readonly string[];
  readonly reason?: string;
}

/**
 * The archived payment flow only requires questions before the payment question
 * to be valid. A partial payment save may therefore contain invalid answers
 * after the payment question, but it must never bypass an invalid/unknown
 * earlier question. Question order follows the legacy sortKey ordering.
 */
export function validatePaymentPartialSave(
  definition: SurveyDefinition,
  session: SurveyRuntimeSessionSnapshot,
  paymentQuestionUniqueId: string,
): PaymentPartialSaveGuardResult {
  if (session.surveyId !== definition.id || session.answers.surveyId !== definition.id) {
    return Object.freeze({
      allowed: false,
      invalidPreviousQuestionIds: Object.freeze([]),
      unknownPreviousQuestionIds: Object.freeze([]),
      reason: 'The payment partial-save session does not belong to this survey.',
    });
  }

  const orderedQuestions = definition.questions
    .map((question, index) => ({ question, index }))
    .sort((left, right) =>
      (left.question.sortKey ?? left.index) - (right.question.sortKey ?? right.index) ||
      left.index - right.index,
    );
  const matches = orderedQuestions.filter(({ question }) =>
    question.id === paymentQuestionUniqueId ||
    question.sourceId === paymentQuestionUniqueId ||
    question.uniqueIdPerForm === paymentQuestionUniqueId,
  );
  if (matches.length !== 1) {
    return Object.freeze({
      allowed: false,
      invalidPreviousQuestionIds: Object.freeze([]),
      unknownPreviousQuestionIds: Object.freeze([]),
      reason: matches.length === 0
        ? 'The payment question could not be resolved in the survey definition.'
        : 'The payment question identifier is ambiguous in the survey definition.',
    });
  }

  const paymentIndex = matches[0].index;
  const orderedIndex = orderedQuestions.indexOf(matches[0]);
  const statuses = new Map(
    session.projection.validation.questions.map((item) => [item.questionId, item.status]),
  );
  const invalidPreviousQuestionIds: string[] = [];
  const unknownPreviousQuestionIds: string[] = [];

  for (const { question } of orderedQuestions.slice(0, orderedIndex)) {
    const status = statuses.get(question.id);
    if (status === 'invalid') invalidPreviousQuestionIds.push(question.id);
    else if (status === undefined || status === 'unknown') unknownPreviousQuestionIds.push(question.id);
  }

  const allowed = invalidPreviousQuestionIds.length === 0 && unknownPreviousQuestionIds.length === 0;
  return Object.freeze({
    allowed,
    paymentQuestionId: matches[0].question.id,
    invalidPreviousQuestionIds: Object.freeze(invalidPreviousQuestionIds),
    unknownPreviousQuestionIds: Object.freeze(unknownPreviousQuestionIds),
    reason: allowed ? undefined : invalidPreviousQuestionIds.length
      ? 'Complete previous questions before starting payment.'
      : 'The validity of one or more previous questions is unresolved.',
  });
}

export interface RuntimeSubmissionResult {
  readonly projection: LoopSubmissionProjection;
  readonly payload: SubmissionPayloadBuildResult;
}

/**
 * Serializes the authoritative session snapshot for submission.
 *
 * Unlike the loop-only serializer, this includes ordinary sections from the
 * root answer instance and repeated sections from their isolated loop instances.
 * The currently displayed loop page is considered filled for this submission,
 * matching the legacy storeSection(currentSection, true) behavior.
 */
export function buildSurveyRuntimeSubmission(
  definition: SurveyDefinition,
  session: SurveyRuntimeSessionSnapshot,
  metadata: SurveySubmissionMetadata,
  options: RuntimeSubmissionOptions = {},
): RuntimeSubmissionResult {
  const diagnostics: LoopSubmissionProjection['diagnostics'][number][] = [];
  if (session.surveyId !== definition.id ||
      session.answers.surveyId !== definition.id ||
      session.loops.surveyId !== definition.id) {
    diagnostics.push({
      code: 'RUNTIME_SUBMISSION_SURVEY_MISMATCH',
      severity: 'error',
      path: 'surveyId',
      message: 'Definition and runtime session snapshots must belong to the same survey.',
    });
    const projection = freezeProjection([], {}, diagnostics, false);
    return { projection, payload: buildCreateVoterWithDetailsDto(metadata, projection) };
  }

  // Partial payment follows the archived rule: only answers before the payment
  // question must be valid. Answers at/after that question may remain incomplete.
  if (metadata.isPartial) {
    const guard = validatePaymentPartialSave(
      definition,
      session,
      metadata.partialPayment?.partialRegisterFormQuestionUniqueId ?? '',
    );
    if (!guard.allowed) {
      diagnostics.push({
        code: 'RUNTIME_PAYMENT_PARTIAL_SAVE_BLOCKED',
        severity: 'error',
        path: 'partialPayment',
        message: guard.reason ?? 'Payment partial save is not allowed.',
      });
    }
  }

  // Temporary saves intentionally preserve incomplete forms. Partial payment
  // saves have their own ordered precondition above; final submissions remain strict.
  if (diagnostics.length > 0 ||
      (!session.projection.validation.isValid && !metadata.temporarySave && !metadata.isPartial)) {
    if (!diagnostics.length) diagnostics.push({
      code: 'RUNTIME_SUBMISSION_VALIDATION_FAILED',
      severity: 'error',
      path: 'validation',
      message: 'The runtime session contains invalid or unresolved answers.',
    });
    const projection = freezeProjection([], {}, diagnostics, false);
    return { projection, payload: buildCreateVoterWithDetailsDto(metadata, projection) };
  }

  let loops = session.loops;
  const currentPage = session.projection.flow.pages.find((page) => page.id === session.currentPageId);
  if (currentPage?.sectionId && currentPage.loopIterationIndex !== undefined &&
      loops.sections[currentPage.sectionId]) {
    loops = setSurveyLoopIterationFilled(
      loops, currentPage.sectionId, currentPage.loopIterationIndex, true,
    );
  }

  const formSections: VoterAnswerDetailListAndSectionIdDto[] = [];
  const variablesLastValue: Record<string, string> = {};
  const questionVisibility = new Map(
    session.projection.visibility.questions.map((item) => [item.questionId, item]),
  );
  const endedQuestionIds = new Set(
    session.projection.evaluation.proposedActions
      .filter((action) => action.actionType === ExpressionActionsEnum.EndForm && action.conditionMet)
      .map((action) => action.formQuestionUniqueId)
      .filter((id): id is string => !!id),
  );

  // Resolve section aliases once; avoid filtering every question for every section.
  const sectionIdsByReference = new Map<string, Set<string>>();
  for (const section of definition.sections) {
    for (const reference of [section.uniqueIdPerForm, section.sourceId, section.id]) {
      if (!reference) continue;
      let sectionIds = sectionIdsByReference.get(reference);
      if (!sectionIds) {
        sectionIds = new Set<string>();
        sectionIdsByReference.set(reference, sectionIds);
      }
      sectionIds.add(section.id);
    }
  }
  const questionsBySection = new Map<string, SurveyQuestionDefinition[]>();
  for (const section of definition.sections) questionsBySection.set(section.id, []);
  for (const question of definition.questions) {
    const sectionIds = question.formSectionUniqueId
      ? sectionIdsByReference.get(question.formSectionUniqueId)
      : undefined;
    if (!sectionIds) continue;
    for (const sectionId of sectionIds) questionsBySection.get(sectionId)!.push(question);
  }

  for (const section of definition.sections) {
    const loopSection = loops.sections[section.id];
    const iterations: readonly SurveyLoopIteration[] = loopSection
      ? loopSection.iterations
          .filter((item) => item.isFilled)
          .slice()
          .sort((a, b) => a.iterationIndex - b.iterationIndex)
      : [{
          iterationIndex: 0,
          backendLoopNumber: 1,
          answerInstanceId: 'root',
          status: 'completed',
          isFilled: true,
          variables: {},
        }];

    const questions = questionsBySection.get(section.id) ?? [];
    const repeatSections: RepeatedFormSectionDto[] = [];

    for (const iteration of iterations) {
      const instance = session.answers.instances[iteration.answerInstanceId];
      if (!instance) {
        diagnostics.push({
          code: 'RUNTIME_SUBMISSION_INSTANCE_MISSING',
          severity: 'error',
          path: section.id + '#' + iteration.iterationIndex,
          message: 'A section iteration has no matching canonical answer instance.',
        });
        continue;
      }

      const voterAnswerDetails: CreateVoterAnswerDetailDto[] = [];
      for (const question of questions) {
        const answer = instance[question.id];
        if (!answer) {
          diagnostics.push({
            code: 'RUNTIME_SUBMISSION_ANSWER_MISSING',
            severity: 'error',
            path: section.id + '#' + iteration.iterationIndex + '.' + question.id,
            message: 'A question is missing from its canonical answer instance.',
          });
          continue;
        }

        const visibility = questionVisibility.get(question.id);
        const visibleOptionIds = visibility?.options
          .filter((option) => option.isVisible === true)
          .map((option) => option.optionId);
        const isVisible = visibility?.isVisible === true;
        const isEndForm = endedQuestionIds.has(question.id) ||
          endedQuestionIds.has(question.sourceId ?? '') ||
          endedQuestionIds.has(question.uniqueIdPerForm ?? '');
        try {
          const serialized = (options.serializeQuestion ?? serializeQuestionAnswer)(
            question,
            answer,
            {
              sectionId: section.id,
              iteration,
              answerInstanceId: iteration.answerInstanceId,
              dynamicDataRecordId: iteration.dynamicDataRecordId,
              isVisible,
              isEndForm,
              hasVisibleQuestionOrOption: isVisible &&
                (question.options.length === 0 || (visibleOptionIds?.length ?? 0) > 0),
              visibleOptionIds,
            },
          );
          voterAnswerDetails.push(...serialized);
        } catch (error) {
          diagnostics.push({
            code: 'RUNTIME_SUBMISSION_QUESTION_SERIALIZATION_FAILED',
            severity: 'error',
            path: section.id + '#' + iteration.iterationIndex + '.' + question.id,
            message: error instanceof Error ? error.message : 'Question answer serialization failed.',
          });
        }
      }

      if (!voterAnswerDetails.length) continue;
      const variables = loopSection ? { ...iteration.variables } : {};
      repeatSections.push(new RepeatedFormSectionDto({
        voterAnswerDetails,
        variablesRepeatedSectionValue: variables,
      }));
      if (loopSection) Object.assign(variablesLastValue, variables);
    }

    if (repeatSections.length) {
      formSections.push(new VoterAnswerDetailListAndSectionIdDto({ repeatSections }));
    }
  }

  const isValid = !diagnostics.some((item) => item.severity === 'error');
  const projection = freezeProjection(
    isValid ? formSections : [],
    isValid ? variablesLastValue : {},
    diagnostics,
    isValid,
  );
  return {
    projection,
    payload: buildCreateVoterWithDetailsDto(metadata, projection),
  };
}

function freezeProjection(
  formSections: readonly VoterAnswerDetailListAndSectionIdDto[],
  variablesLastValue: Readonly<Record<string, string>>,
  diagnostics: readonly LoopSubmissionProjection['diagnostics'][number][],
  isValid: boolean,
): LoopSubmissionProjection {
  for (const section of formSections) {
    for (const repeated of section.repeatSections ?? []) {
      for (const answer of repeated.voterAnswerDetails ?? []) Object.freeze(answer);
      if (repeated.voterAnswerDetails) Object.freeze(repeated.voterAnswerDetails);
      if (repeated.variablesRepeatedSectionValue) Object.freeze(repeated.variablesRepeatedSectionValue);
      Object.freeze(repeated);
    }
    if (section.repeatSections) Object.freeze(section.repeatSections);
    Object.freeze(section);
  }
  for (const item of diagnostics) Object.freeze(item);
  return Object.freeze({
    formSections: Object.freeze([...formSections]),
    variablesLastValue: Object.freeze({ ...variablesLastValue }),
    diagnostics: Object.freeze([...diagnostics]),
    isValid,
  });
}
