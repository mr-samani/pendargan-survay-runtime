import {
  CreateVoterAnswerDetailDto,
  RepeatedFormSectionDto,
  VoterAnswerDetailListAndSectionIdDto,
} from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { AnswerStateSnapshot, QuestionAnswerState } from '../state/answer-state.types';
import type { SurveyLoopIteration, SurveyLoopRuntimeSnapshot } from './loop-runtime';
import { QuestionAnswerSerializationError, serializeQuestionAnswer } from '../submission/question-answer-serializer';

export interface LoopAnswerSerializationContext {
  readonly sectionId: string;
  readonly iteration: SurveyLoopIteration;
  readonly answerInstanceId: string;
  readonly dynamicDataRecordId?: string | number;
}
export type LoopQuestionAnswerSerializer = (
  question: SurveyQuestionDefinition,
  answer: QuestionAnswerState,
  context: LoopAnswerSerializationContext,
) => readonly CreateVoterAnswerDetailDto[];

export interface LoopSubmissionDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly path: string;
  readonly message: string;
}
export interface LoopSubmissionProjection {
  readonly formSections: readonly VoterAnswerDetailListAndSectionIdDto[];
  readonly variablesLastValue: Readonly<Record<string, string>>;
  readonly diagnostics: readonly LoopSubmissionDiagnostic[];
  readonly isValid: boolean;
}

/**
 * Projects loop answers into the exact repeated-section DTO envelope used by
 * the legacy converter. Question-specific answer conversion remains injected,
 * because files/descriptions/payment/dynamic answers have type-specific payloads.
 */
export function serializeSurveyLoopSubmission(
  definition: SurveyDefinition,
  runtime: SurveyLoopRuntimeSnapshot,
  answerState: AnswerStateSnapshot,
  serializeQuestion: LoopQuestionAnswerSerializer = (question, answer, context) =>
    serializeQuestionAnswer(question, answer, {
      dynamicDataRecordId: context.dynamicDataRecordId,
      isVisible: question.source['dontShow'] === true || question.source['endForm'] === true
        ? false : undefined,
      isEndForm: question.source['endForm'] === true,
      hasVisibleQuestionOrOption: question.source['hasVisibleQuestionOrOption'] === false ? false : undefined,
    }),
): LoopSubmissionProjection {
  const diagnostics: LoopSubmissionDiagnostic[] = [];
  if (runtime.surveyId !== definition.id || answerState.surveyId !== definition.id) {
    diagnostics.push({
      code: 'LOOP_SUBMISSION_SURVEY_MISMATCH',
      severity: 'error',
      path: 'surveyId',
      message: 'Definition, loop runtime, and answer state must belong to the same survey.',
    });
    return freezeProjection({ formSections: [], variablesLastValue: {}, diagnostics, isValid: false });
  }

  const formSections: VoterAnswerDetailListAndSectionIdDto[] = [];
  const variablesLastValue: Record<string, string> = {};

  for (const section of definition.sections) {
    const sectionRuntime = runtime.sections[section.id];
    if (!sectionRuntime) continue;
    const repeated: RepeatedFormSectionDto[] = [];
    const sectionQuestions = definition.questions.filter((question) =>
      question.formSectionUniqueId === section.uniqueIdPerForm ||
      question.formSectionUniqueId === section.sourceId ||
      question.formSectionUniqueId === section.id);

    for (const iteration of [...sectionRuntime.iterations].sort((a, b) => a.iterationIndex - b.iterationIndex)) {
      if (!iteration.isFilled) continue;
      const instance = answerState.instances[iteration.answerInstanceId];
      if (!instance) {
        diagnostics.push({
          code: 'LOOP_SUBMISSION_INSTANCE_MISSING',
          severity: 'error',
          path: section.id + '#' + iteration.iterationIndex,
          message: 'A filled loop iteration has no corresponding answer instance.',
        });
        continue;
      }

      const voterAnswerDetails: CreateVoterAnswerDetailDto[] = [];
      for (const question of sectionQuestions) {
        const answer = instance[question.id];
        if (!answer) {
          diagnostics.push({
            code: 'LOOP_SUBMISSION_QUESTION_STATE_MISSING',
            severity: 'error',
            path: section.id + '#' + iteration.iterationIndex + '.' + question.id,
            message: 'A question in the loop section is missing from its answer instance.',
          });
          continue;
        }
        try {
          const serialized = serializeQuestion(question, answer, {
            sectionId: section.id,
            iteration,
            answerInstanceId: iteration.answerInstanceId,
            dynamicDataRecordId: iteration.dynamicDataRecordId,
          });
          voterAnswerDetails.push(...serialized.map((item) =>
            CreateVoterAnswerDetailDto.fromJS(item.toJSON())));
        } catch (error) {
          diagnostics.push({
            code: error instanceof QuestionAnswerSerializationError
              ? error.code : 'LOOP_SUBMISSION_QUESTION_SERIALIZATION_FAILED',
            severity: 'error',
            path: error instanceof QuestionAnswerSerializationError
              ? error.path : section.id + '#' + iteration.iterationIndex + '.' + question.id,
            message: error instanceof Error ? error.message : 'Question answer serialization failed.',
          });
        }
      }

      // The legacy converter omits a filled iteration when it produces no answer details.
      if (!voterAnswerDetails.length) continue;
      const variables = { ...iteration.variables };
      repeated.push(new RepeatedFormSectionDto({
        voterAnswerDetails,
        variablesRepeatedSectionValue: variables,
      }));
      Object.assign(variablesLastValue, variables);
    }

    // The generated legacy DTO has no explicit section ID; array order follows definition order.
    if (repeated.length) {
      formSections.push(new VoterAnswerDetailListAndSectionIdDto({ repeatSections: repeated }));
    }
  }

  const isValid = !diagnostics.some((item) => item.severity === 'error');
  return freezeProjection({
    formSections: isValid ? formSections : [],
    variablesLastValue: isValid ? variablesLastValue : {},
    diagnostics,
    isValid,
  });
}

function freezeProjection(value: LoopSubmissionProjection): LoopSubmissionProjection {
  for (const section of value.formSections) {
    for (const repeated of section.repeatSections ?? []) {
      for (const answer of repeated.voterAnswerDetails ?? []) Object.freeze(answer);
      if (repeated.voterAnswerDetails) Object.freeze(repeated.voterAnswerDetails);
      if (repeated.variablesRepeatedSectionValue) Object.freeze(repeated.variablesRepeatedSectionValue);
      Object.freeze(repeated);
    }
    if (section.repeatSections) Object.freeze(section.repeatSections);
    Object.freeze(section);
  }
  for (const diagnostic of value.diagnostics) Object.freeze(diagnostic);
  Object.freeze(value.formSections);
  Object.freeze(value.variablesLastValue);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
