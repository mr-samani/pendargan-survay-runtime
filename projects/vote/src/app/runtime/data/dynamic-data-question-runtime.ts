import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { DynamicDataOption } from './dynamic-data-http-loader';
import {
  mergeDynamicSkuOptions,
  findRestorableDynamicAnswer,
  type DynamicSkuSelection,
} from './dynamic-data-selection';

export interface DynamicDataQuestionRegistrationSource {
  readonly uniqueIdPerForm?: string | null;
  readonly uniqueId?: string | null;
  readonly questionType?: FormQuestionTypesEnum;
  readonly dynamicDataUniqueId?: string | null;
}

export interface DynamicDataQuestionRuntimeRegistration {
  readonly questionId: string;
  readonly dynamicDataUniqueId: string;
  readonly formGuid: string;
  readonly mode: 'autocomplete' | 'sku-initial-list';
}

/** Builds a registration from the actual form-question DTO; unsupported types are ignored. */
export function createDynamicDataQuestionRegistration(
  question: DynamicDataQuestionRegistrationSource,
  formGuid: string,
): DynamicDataQuestionRuntimeRegistration | undefined {
  const questionId = question.uniqueIdPerForm ?? question.uniqueId;
  if (!questionId || !question.dynamicDataUniqueId || !formGuid) return undefined;

  let mode: DynamicDataQuestionRuntimeRegistration['mode'];
  switch (question.questionType) {
    case FormQuestionTypesEnum.DynamicAnswer:
      mode = 'autocomplete';
      break;
    case FormQuestionTypesEnum.SkuCount_Dynamic:
      mode = 'sku-initial-list';
      break;
    default:
      return undefined;
  }

  return Object.freeze({
    questionId,
    dynamicDataUniqueId: question.dynamicDataUniqueId,
    formGuid,
    mode,
  });
}

export interface DynamicAnswerReconciliation<T extends DynamicDataOption> {
  readonly options: readonly (T & { readonly isSelectedInSectionLoop: boolean })[];
  readonly selection?: T;
}

/**
 * Reconciles a DynamicAnswer list without matching by display text. A saved
 * answer is restored by identificationCode; loop duplicates remain visible
 * but are marked as unavailable, matching the archived renderer's behavior.
 */
export function reconcileDynamicAnswerOptions<T extends DynamicDataOption>(
  fetched: readonly T[],
  previous: T | undefined,
  reservedIdentificationCodes: readonly (string | number)[],
  autoSelectFirstOption: boolean,
): DynamicAnswerReconciliation<T> {
  const reserved = new Set(reservedIdentificationCodes.map(String));
  const options = fetched.map((option) => Object.freeze({
    ...option,
    isSelectedInSectionLoop: reserved.has(String(option.identificationCode)),
  }));
  const restored = findRestorableDynamicAnswer(previous, options);
  const selection = restored && !restored.isSelectedInSectionLoop
    ? restored
    : !previous && autoSelectFirstOption
      ? options.find((option) => !option.isSelectedInSectionLoop)
      : undefined;

  return Object.freeze({
    options: Object.freeze(options),
    selection,
  });
}

export interface DynamicSkuRuntimeOptions {
  readonly dynamicDataUniqueId: string;
  readonly showAdvanceButtons: boolean;
}

/** Reconciles the SKU initial-list response while preserving user-entered state. */
export function reconcileDynamicSkuOptions<T extends DynamicDataOption & {
  readonly ordering: number;
  readonly quantity?: number;
  readonly total?: number | null;
  readonly history?: readonly number[];
}>(
  selected: readonly T[],
  fetched: readonly T[],
  restoredAnswers: readonly DynamicSkuSelection[],
  options: DynamicSkuRuntimeOptions,
): readonly T[] {
  return mergeDynamicSkuOptions(selected, fetched, restoredAnswers, options) as readonly T[];
}

export type DynamicSkuValidationError = 'min' | 'invalid' | null;

/** Mirrors the legacy required SKU validation: zero is a valid entered total. */
export function validateDynamicSkuSelection(
  selected: readonly Pick<DynamicSkuSelection, 'total'>[],
  required: boolean,
): DynamicSkuValidationError {
  if (!required) return null;
  if (selected.length === 0) return 'min';
  if (selected.some((item) => item.total === null || item.total === undefined || item.total === '')) {
    return 'invalid';
  }
  return null;
}

export interface DynamicSkuItemState extends DynamicSkuSelection {
  readonly answerTitle?: string;
  readonly ordering?: number;
  readonly dynamicDataUniqueId?: string;
}

export function addDynamicSku(
  selected: readonly DynamicSkuItemState[],
  option: DynamicSkuItemState,
  dynamicDataUniqueId: string,
  showAdvanceButtons: boolean,
): readonly DynamicSkuItemState[] {
  if (selected.some((item) => String(item.identificationCode) === String(option.identificationCode))) {
    return selected;
  }
  return Object.freeze([...selected, Object.freeze({
    ...option,
    quantity: 1,
    total: showAdvanceButtons ? 0 : null,
    history: Object.freeze([]),
    dynamicDataUniqueId,
  })]);
}

export function removeDynamicSku(
  selected: readonly DynamicSkuItemState[],
  identificationCode: string | number,
): readonly DynamicSkuItemState[] {
  const next = selected.filter((item) => String(item.identificationCode) !== String(identificationCode));
  return next.length === selected.length ? selected : Object.freeze(next);
}

/** Legacy plus action: add current quantity to total, remember it, reset quantity to one. */
export function incrementDynamicSku(
  selected: readonly DynamicSkuItemState[],
  identificationCode: string | number,
): readonly DynamicSkuItemState[] {
  return updateDynamicSku(selected, identificationCode, (item) => {
    const quantity = toFiniteNumber(item.quantity, 1);
    return {
      ...item,
      total: toFiniteNumber(item.total, 0) + quantity,
      quantity: 1,
      history: Object.freeze([...(item.history ?? []), quantity]),
    };
  });
}

/** Legacy minus action: subtract current quantity, clamp at zero, remember a negative entry. */
export function decrementDynamicSku(
  selected: readonly DynamicSkuItemState[],
  identificationCode: string | number,
): readonly DynamicSkuItemState[] {
  return updateDynamicSku(selected, identificationCode, (item) => {
    const quantity = toFiniteNumber(item.quantity, 1);
    const total = toFiniteNumber(item.total, 0);
    if (total <= 0) return item;
    return {
      ...item,
      total: Math.max(0, total - quantity),
      quantity: 1,
      history: Object.freeze([...(item.history ?? []), -quantity]),
    };
  });
}

export function setDynamicSkuTotal(
  selected: readonly DynamicSkuItemState[],
  identificationCode: string | number,
  total: number | null,
): readonly DynamicSkuItemState[] {
  return updateDynamicSku(selected, identificationCode, (item) =>
    Object.is(item.total, total) ? item : { ...item, total });
}

export function sumDynamicSkuTotals(selected: readonly DynamicSkuItemState[]): number {
  return selected.reduce((sum, item) => sum + toFiniteNumber(item.total, 0), 0);
}

function updateDynamicSku(
  selected: readonly DynamicSkuItemState[],
  identificationCode: string | number,
  update: (item: DynamicSkuItemState) => DynamicSkuItemState,
): readonly DynamicSkuItemState[] {
  const index = selected.findIndex((item) =>
    String(item.identificationCode) === String(identificationCode));
  if (index < 0) return selected;
  const current = selected[index];
  const nextItem = update(current);
  if (nextItem === current) return selected;
  const next = selected.slice();
  next[index] = Object.freeze(nextItem);
  return Object.freeze(next);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
