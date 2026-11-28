import {
  FormQuestionTypesEnum,
  FormSectionLoopQuestionAnswerDto,
} from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { AnswerValue, QuestionAnswerState } from '../state/answer-state.types';
import {
  restoreQuestionAnswer,
  type QuestionAnswerRestoreDiagnostic,
  type QuestionAnswerRestoreResult,
} from './question-answer-restorer';

export interface RetailAuditRestoreResult extends QuestionAnswerRestoreResult {}

interface RetailAuditChildAnswer {
  readonly questionId: string;
  readonly questionType?: FormQuestionTypesEnum;
  readonly parentUniqueId?: string | null;
  readonly answer: AnswerValue;
  readonly selectedOptionIds: readonly string[];
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly dontShow: boolean;
  readonly endForm: boolean;
  readonly shouldClearEditableInitialValue?: boolean;
  readonly questionChilds: readonly RetailAuditChildAnswer[];
}

export function restoreRetailAuditAnswer(
  question: SurveyQuestionDefinition,
  definition: SurveyDefinition,
  repeatedPages: readonly FormSectionLoopQuestionAnswerDto[],
  revision = 0,
): RetailAuditRestoreResult {
  const diagnostics: QuestionAnswerRestoreDiagnostic[] = [];
  const items: AnswerValue[] = [];

  for (let pageIndex = 0; pageIndex < repeatedPages.length; pageIndex++) {
    const page = repeatedPages[pageIndex];
    const retailQuestion = (page.sectionQuestionAnswerDetail ?? []).find((item) =>
      item.questionType === FormQuestionTypesEnum.RetailAudit);
    const retailRow = retailQuestion?.voterAnswerDetailDto?.[0];
    if (!retailRow) continue;

    const childAnswers: RetailAuditChildAnswer[] = [];
    for (const savedChild of (page.sectionQuestionAnswerDetail ?? []).filter((item) =>
      item.questionType !== FormQuestionTypesEnum.RetailAudit)) {
      const childQuestion = definition.questions.find((item) =>
        item.sourceId === savedChild.uniqueId || item.uniqueIdPerForm === savedChild.uniqueId);
      if (!childQuestion) {
        diagnostics.push({
          code: 'RESTORE_RETAIL_CHILD_NOT_IN_DEFINITION',
          severity: 'warning',
          path: question.id + '.items[' + pageIndex + '].' + String(savedChild.uniqueId ?? ''),
          message: 'A saved RetailAudit child question is no longer present in the definition.',
        });
        continue;
      }
      const restored = restoreQuestionAnswer(childQuestion, savedChild, revision);
      diagnostics.push(...restored.diagnostics);
      childAnswers.push(toRetailChild(childQuestion, restored.answer));
    }

    const retailParentIds = new Set([
      question.sourceId, question.uniqueIdPerForm, question.id,
    ].filter((item): item is string => !!item));
    // Descendants of Matrix/Group containers belong only inside their parent;
    // they must not also appear as sibling RetailAudit child questions.
    const nested = childAnswers.filter((child) =>
      !child.parentUniqueId || retailParentIds.has(child.parentUniqueId),
    ).map((child) => {
      const parent = definition.questions.find((candidate) =>
        candidate.sourceId === child.questionId ||
        candidate.uniqueIdPerForm === child.questionId ||
        candidate.id === child.questionId);
      const hasChildren = parent && [
        FormQuestionTypesEnum.Matrix,
        FormQuestionTypesEnum.Matrix_Dynamic,
        FormQuestionTypesEnum.Group,
      ].includes(parent.questionType as FormQuestionTypesEnum);
      if (!hasChildren) return child;
      const childBackendIds = new Set([
        parent.sourceId, parent.uniqueIdPerForm, parent.id,
      ].filter((item): item is string => !!item));
      return Object.freeze({
        ...child,
        questionChilds: Object.freeze(childAnswers.filter((candidate) =>
          !!candidate.parentUniqueId && childBackendIds.has(candidate.parentUniqueId))),
      });
    });

    const formValid = nested.every(isRetailAuditChildValid);

    const answerTitle = retailRow.answerTitle ?? '';
    const item: Record<string, AnswerValue> = {
      identificationCode: retailRow.dynamicDataRecordId ?? 0,
      answerTitle,
      dynamicDataUniqueId: optionalString(question.source['dynamicDataUniqueId']) ?? '',
      quantity: 0,
      total: 0,
      history: [],
      questionChilds: nested as unknown as AnswerValue,
      formValid,
      jsonValuesDictionary: stringRecord(retailRow.jsonValuesDictionary),
      answerTitleLower: answerTitle.toLowerCase(),
      answerTitleLowerNoSpace: answerTitle.toLowerCase().replace(/ /g, ''),
      retaliVariables: {},
      ordering: 0,
    };
    items.push(Object.freeze(item));
  }

  const answer: QuestionAnswerState = Object.freeze({
    questionId: question.id,
    value: Object.freeze(items),
    selectedOptionIds: Object.freeze([]),
    isDirty: false,
    updatedAtRevision: revision,
  });
  for (const item of diagnostics) Object.freeze(item);
  return Object.freeze({
    answer,
    diagnostics: Object.freeze(diagnostics),
    hasSavedAnswer: items.length > 0,
    shouldClearEditableInitialValue: false,
  });
}

function toRetailChild(
  question: SurveyQuestionDefinition,
  answer: QuestionAnswerState,
): RetailAuditChildAnswer {
  const restored: {
    questionId: string;
    questionType?: FormQuestionTypesEnum;
    parentUniqueId?: string | null;
    answer: AnswerValue;
    selectedOptionIds: readonly string[];
    isRequired: boolean;
    isActive: boolean;
    dontShow: boolean;
    endForm: boolean;
    shouldClearEditableInitialValue: boolean;
    questionChilds: readonly RetailAuditChildAnswer[];
  } = {
    questionId: question.sourceId ?? question.uniqueIdPerForm ?? question.id,
    answer: answer.value,
    selectedOptionIds: answer.selectedOptionIds,
    isRequired: question.isRequired,
    isActive: question.isActive,
    dontShow: question.source['dontShow'] === true,
    endForm: question.source['endForm'] === true,
    shouldClearEditableInitialValue: answer.shouldClearEditableInitialValue ?? false,
    questionChilds: Object.freeze([]),
  };
  if (question.questionType !== undefined) restored.questionType = question.questionType;
  if (question.parentUniqueId !== undefined) restored.parentUniqueId = question.parentUniqueId;
  return Object.freeze(restored);
}


function isRetailAuditChildValid(child: RetailAuditChildAnswer): boolean {
  if (!child.isActive || child.dontShow || child.endForm) return true;
  const childrenValid = child.questionChilds.every(isRetailAuditChildValid);
  if (!childrenValid) return false;
  if ([
    FormQuestionTypesEnum.Matrix,
    FormQuestionTypesEnum.Matrix_Dynamic,
    FormQuestionTypesEnum.Group,
  ].includes(child.questionType as FormQuestionTypesEnum)) return true;
  return !child.isRequired || !isLegacyEmpty(child.answer);
}

function isLegacyEmpty(value: AnswerValue): boolean {
  return value === null || value === '' || value === 'null' || value === 'undefined';
}
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function stringRecord(value: Record<string, string> | null | undefined): Record<string, AnswerValue> {
  const result: Record<string, AnswerValue> = {};
  for (const [key, item] of Object.entries(value ?? {})) result[key] = item;
  return result;
}
