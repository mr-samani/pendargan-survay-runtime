import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { QuestionModel } from '../models/question';
import type { AnswerValue } from '../../runtime/state/answer-state.types';

export interface RetailAuditChildOption {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;
}
export interface RetailAuditChildNode {
  readonly questionId: string;
  readonly sourceId?: string;
  readonly parentUniqueId?: string | null;
  readonly title: string;
  readonly questionType?: FormQuestionTypesEnum;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly dontShow: boolean;
  readonly endForm: boolean;
  readonly answer: AnswerValue;
  readonly selectedOptionIds: readonly string[];
  readonly options: readonly RetailAuditChildOption[];
  readonly questionChilds: readonly RetailAuditChildNode[];
}
export interface RetailAuditChildRow {
  readonly node: RetailAuditChildNode;
  readonly depth: number;
}

const CONTAINER_TYPES = new Set<FormQuestionTypesEnum>([
  FormQuestionTypesEnum.Group, FormQuestionTypesEnum.Matrix, FormQuestionTypesEnum.Matrix_Dynamic,
]);
const MULTI_CHOICE_TYPES = new Set<FormQuestionTypesEnum>([
  FormQuestionTypesEnum.MultiSelect, FormQuestionTypesEnum.MultiSelectWithImageOptions,
  FormQuestionTypesEnum.Matrix_Checkbox, FormQuestionTypesEnum.HasPriority,
]);
const CHOICE_TYPES = new Set<FormQuestionTypesEnum>([
  ...MULTI_CHOICE_TYPES, FormQuestionTypesEnum.UniqueSelect,
  FormQuestionTypesEnum.UniqueSelectWithImageOptions, FormQuestionTypesEnum.Dropdown,
  FormQuestionTypesEnum.Matrix_Radio, FormQuestionTypesEnum.Emoji,
]);
const SCALAR_TYPES = new Set<FormQuestionTypesEnum>([
  FormQuestionTypesEnum.ShortText, FormQuestionTypesEnum.LongText,
  FormQuestionTypesEnum.CustomMaskShortText, FormQuestionTypesEnum.Numeric,
  FormQuestionTypesEnum.Point, FormQuestionTypesEnum.Point_NumericScale,
  FormQuestionTypesEnum.NPS, FormQuestionTypesEnum.Rating,
  FormQuestionTypesEnum.Date, FormQuestionTypesEnum.Time, FormQuestionTypesEnum.Email,
  FormQuestionTypesEnum.Phone, FormQuestionTypesEnum.Mobile, FormQuestionTypesEnum.NationalCode,
  FormQuestionTypesEnum.PostalCode,
]);

export function buildRetailAuditChildTree(
  parent: QuestionModel,
  allQuestions: readonly QuestionModel[],
  saved: readonly unknown[] = [],
): readonly RetailAuditChildNode[] {
  const parentRefs = new Set([parent.uniqueId, parent.uniqueIdPerForm].filter(isString));
  const build = (
    question: QuestionModel,
    savedCandidates: readonly Record<string, unknown>[],
    ancestors: ReadonlySet<string>,
  ): RetailAuditChildNode | undefined => {
    const id = question.uniqueIdPerForm ?? question.uniqueId;
    if (!id || ancestors.has(id)) return undefined;
    const nextAncestors = new Set(ancestors).add(id);
    const prior = savedCandidates.find((item) => matchesQuestion(item, question));
    const rawAnswer = prior?.['answer'] ?? null;
    const nestedSaved = Array.isArray(prior?.['questionChilds'])
      ? prior['questionChilds'].map(asRecord).filter(isRecord)
      : [];
    const children = CONTAINER_TYPES.has(question.questionType as FormQuestionTypesEnum)
      ? allQuestions
          .filter((candidate) => candidate.parentUniqueId === question.uniqueId ||
            candidate.parentUniqueId === question.uniqueIdPerForm)
          .map((candidate) => build(candidate, nestedSaved, nextAncestors))
          .filter((item): item is RetailAuditChildNode => item !== undefined)
      : [];
    return Object.freeze({
      questionId: id,
      sourceId: question.uniqueId ?? undefined,
      parentUniqueId: question.parentUniqueId,
      title: question.title ?? '',
      questionType: question.questionType,
      isRequired: question.isRequired === true,
      isActive: question.isActive !== false,
      dontShow: prior?.['dontShow'] === true,
      endForm: prior?.['endForm'] === true,
      answer: toAnswerValue(rawAnswer),
      selectedOptionIds: Object.freeze(readSelectedOptions(prior, rawAnswer, question)),
      options: Object.freeze((question.questionOptions ?? []).map((option) => Object.freeze({
        id: option.uniqueIdPerForm ?? option.uniqueId ?? '',
        title: option.title ?? '',
        visible: option.canShow !== false && option.dontShow !== true,
      })).filter((option) => option.id.length > 0)),
      questionChilds: Object.freeze(children),
    });
  };
  const savedNodes = saved.map(asRecord).filter(isRecord);
  return Object.freeze(allQuestions
    .filter((question) => parentRefs.has(question.parentUniqueId ?? ''))
    .map((question) => build(question, savedNodes, new Set()))
    .filter((item): item is RetailAuditChildNode => item !== undefined));
}

export function flattenRetailAuditChildRows(nodes: readonly RetailAuditChildNode[]): readonly RetailAuditChildRow[] {
  const rows: RetailAuditChildRow[] = [];
  const visit = (items: readonly RetailAuditChildNode[], depth: number): void => {
    for (const node of items) {
      if (node.isActive && !node.dontShow && !node.endForm) {
        rows.push(Object.freeze({ node, depth }));
        visit(node.questionChilds, depth + 1);
      }
    }
  };
  visit(nodes, 0);
  return Object.freeze(rows);
}

export function updateRetailAuditChildAnswer(
  nodes: readonly RetailAuditChildNode[], questionId: string, answer: AnswerValue,
  selectedOptionIds: readonly string[] = [],
): readonly RetailAuditChildNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.questionId === questionId) {
      changed = true;
      return Object.freeze({ ...node, answer, selectedOptionIds: Object.freeze([...selectedOptionIds]) });
    }
    if (node.questionChilds.length) {
      const children = updateRetailAuditChildAnswer(node.questionChilds, questionId, answer, selectedOptionIds);
      if (children !== node.questionChilds) {
        changed = true;
        return Object.freeze({ ...node, questionChilds: children });
      }
    }
    return node;
  });
  return changed ? Object.freeze(next) : nodes;
}

export function isRetailAuditChildEditorSupported(node: RetailAuditChildNode): boolean {
  return node.questionChilds.length > 0 || CONTAINER_TYPES.has(node.questionType as FormQuestionTypesEnum) ||
    CHOICE_TYPES.has(node.questionType as FormQuestionTypesEnum) ||
    SCALAR_TYPES.has(node.questionType as FormQuestionTypesEnum);
}
export function isRetailAuditChildChoice(node: RetailAuditChildNode): boolean {
  return CHOICE_TYPES.has(node.questionType as FormQuestionTypesEnum);
}
export function isRetailAuditChildMultiChoice(node: RetailAuditChildNode): boolean {
  return MULTI_CHOICE_TYPES.has(node.questionType as FormQuestionTypesEnum);
}
export function isRetailAuditChildLongText(node: RetailAuditChildNode): boolean {
  return node.questionType === FormQuestionTypesEnum.LongText;
}
export function isRetailAuditChildInputType(node: RetailAuditChildNode): 'number' | 'date' | 'time' | 'email' | 'text' {
  switch (node.questionType) {
    case FormQuestionTypesEnum.Numeric:
    case FormQuestionTypesEnum.Point:
    case FormQuestionTypesEnum.Point_NumericScale:
    case FormQuestionTypesEnum.NPS:
    case FormQuestionTypesEnum.Rating: return 'number';
    case FormQuestionTypesEnum.Date: return 'date';
    case FormQuestionTypesEnum.Time: return 'time';
    case FormQuestionTypesEnum.Email: return 'email';
    default: return 'text';
  }
}

/** undefined preserves the legacy state for a product on which no child answer was entered. */
export function validateRetailAuditChildTree(nodes: readonly RetailAuditChildNode[]): boolean | undefined {
  if (!nodes.some(hasAnyAnswer)) return undefined;
  return nodes.every(isNodeValid);
}
function isNodeValid(node: RetailAuditChildNode): boolean {
  if (!node.isActive || node.dontShow || node.endForm) return true;
  if (!node.questionChilds.every(isNodeValid)) return false;
  if (node.questionChilds.length > 0 || CONTAINER_TYPES.has(node.questionType as FormQuestionTypesEnum)) return true;
  if (!node.isRequired) return true;
  return isRetailAuditChildChoice(node) ? node.selectedOptionIds.length > 0 : !isEmpty(node.answer);
}
function hasAnyAnswer(node: RetailAuditChildNode): boolean {
  return !isEmpty(node.answer) || node.selectedOptionIds.length > 0 || node.questionChilds.some(hasAnyAnswer);
}
function readSelectedOptions(
  saved: Record<string, unknown> | undefined, answer: unknown, question: QuestionModel,
): string[] {
  if (Array.isArray(saved?.['selectedOptionIds'])) {
    return saved['selectedOptionIds'].filter((id): id is string => typeof id === 'string');
  }
  if (typeof answer !== 'string') return [];
  const ids = new Set(answer.split(/،|,/).map((id) => id.trim()).filter(Boolean));
  return (question.questionOptions ?? [])
    .filter((option) => ids.has(option.uniqueId ?? '') || ids.has(option.uniqueIdPerForm ?? ''))
    .map((option) => option.uniqueIdPerForm ?? option.uniqueId ?? '').filter(Boolean);
}
function matchesQuestion(saved: Record<string, unknown>, question: QuestionModel): boolean {
  const id = saved['questionId'] ?? saved['uniqueIdPerForm'] ?? saved['uniqueId'];
  return id === question.uniqueId || id === question.uniqueIdPerForm;
}
function isEmpty(value: AnswerValue): boolean {
  return value === null || value === '' || value === 'null' || value === 'undefined' ||
    (Array.isArray(value) && value.length === 0);
}
function toAnswerValue(value: unknown): AnswerValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(toAnswerValue);
  if (typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, toAnswerValue(item)]),
  );
  return String(value);
}
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function isRecord(value: Record<string, unknown> | undefined): value is Record<string, unknown> {
  return value !== undefined;
}
function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
