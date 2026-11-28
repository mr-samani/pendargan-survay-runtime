import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyFormulaEvaluationContext } from './concrete-runtime-projector';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import type { AnswerValue } from '../state/answer-state.types';

export interface LegacyFormulaFieldValue {
  readonly namespace: string;
  readonly value: string | number | null | undefined;
  readonly isNumeric: boolean;
}

export interface LegacyFormulaVisibility {
  /** false means the legacy question.dontShow flag is true. */
  readonly questionVisibility?: Readonly<Record<string, boolean>>;
  /** false means the legacy option.dontShow flag is true. */
  readonly optionVisibility?: Readonly<Record<string, boolean>>;
}

export interface LegacyFormulaEnvironment {
  readonly lastRegionChildId?: string | null;
  readonly demographyFields?: readonly LegacyFormulaFieldValue[];
  readonly systemFields?: readonly LegacyFormulaFieldValue[];
  readonly visibility?: LegacyFormulaVisibility;
}

export interface LegacyFormulaDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface LegacyFormulaAnswerStateProjection {
  /** Legacy expression fragments, not canonical answer-state values. */
  readonly answerStates: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly LegacyFormulaDiagnostic[];
}

/**
 * Projects one immutable answer instance into the flat token dictionary consumed by
 * the archived LogicService.generateAnswerStates/replaceFormulaValues pipeline.
 *
 * This adapter intentionally does not mutate the canonical answer store. Runtime
 * visibility and environmental fields are explicit inputs because the old service
 * read them from mutable VoteService state.
 */
export function createLegacyFormulaAnswerStates(
  context: SurveyFormulaEvaluationContext,
  environment: LegacyFormulaEnvironment = {},
): LegacyFormulaAnswerStateProjection {
  const instance = context.answers.instances[context.instanceId];
  if (!instance) {
    throw new Error('Legacy formula state cannot be created for unknown answer instance: ' + context.instanceId);
  }

  const states: Record<string, unknown> = Object.create(null);
  const diagnostics: LegacyFormulaDiagnostic[] = [];
  states['Region.UniqueId'] = quote(environment.lastRegionChildId
    ? environment.lastRegionChildId.replace(/-/g, '')
    : '');

  for (const field of environment.demographyFields ?? []) {
    states['Demography.Data.' + field.namespace] = projectFieldValue(field);
  }
  for (const field of environment.systemFields ?? []) {
    states['System.' + field.namespace] = projectFieldValue(field);
  }

  for (const question of context.definition.questions) {
    if (question.questionType === FormQuestionTypesEnum.Group) continue;
    const answer = instance[question.id];
    if (!answer) {
      diagnostics.push({
        code: 'LEGACY_FORMULA_ANSWER_MISSING',
        path: question.id,
        message: 'The active answer instance has no state for this question.',
      });
      continue;
    }

    const fid = compactFid(question.uniqueIdPerForm);
    if (!fid) {
      diagnostics.push({
        code: 'LEGACY_FORMULA_QUESTION_FID_MISSING',
        path: question.id + '.uniqueIdPerForm',
        message: 'The legacy formula token requires uniqueIdPerForm.',
      });
      continue;
    }

    const isQuestionVisible = environment.visibility?.questionVisibility?.[question.id]
      ?? question.source['dontShow'] !== true;
    const selected = new Set(answer.selectedOptionIds);
    const options = question.options;
    const isOptionVisible = (optionId: string, source: Readonly<Record<string, unknown>>) =>
      environment.visibility?.optionVisibility?.[optionId] ?? source['dontShow'] !== true;

    switch (question.questionType) {
      case FormQuestionTypesEnum.UniqueSelect:
      case FormQuestionTypesEnum.Dropdown:
      case FormQuestionTypesEnum.Matrix:
      case FormQuestionTypesEnum.Matrix_Radio:
      case FormQuestionTypesEnum.Emoji:
      case FormQuestionTypesEnum.UniqueSelectWithImageOptions: {
        let selectedCount = 0;
        let answerCount = 0;
        let answerTitle = '';
        let point: number | undefined = 0;
        for (const option of options) {
          const visible = isOptionVisible(option.id, option.source);
          if (visible) answerCount++;
          const isSelected = selected.has(option.id) && isQuestionVisible && visible;
          states[optionToken(fid, option.uniqueIdPerForm)] = isSelected;
          if (isSelected) {
            selectedCount++;
            answerTitle = option.title ?? '';
            point = option.point;
          }
        }
        states['Q' + fid + '.AnswerTitle'] = quote(answerTitle);
        states['Q' + fid + '.Point'] = point;
        states['Q' + fid + '.PointWeigth'] = (point as number) * (readNumber(question.source, 'grade') as number);
        states['Q' + fid + '.SelectedCount'] = selectedCount;
        states['Q' + fid + '.AnswersCount'] = answerCount;
        break;
      }

      case FormQuestionTypesEnum.HasPriority:
      case FormQuestionTypesEnum.MultiSelect:
      case FormQuestionTypesEnum.MultiSelectWithImageOptions:
      case FormQuestionTypesEnum.Matrix_Checkbox: {
        let selectedCount = 0;
        let answerCount = 0;
        let answerTitle = '';
        let point = 0;
        for (const option of options) {
          const visible = isOptionVisible(option.id, option.source);
          if (visible) answerCount++;
          const isSelected = selected.has(option.id) && isQuestionVisible && visible;
          states[optionToken(fid, option.uniqueIdPerForm)] = isSelected;
          if (isSelected) {
            if (answerTitle.length > 0) answerTitle += ', ';
            selectedCount++;
            answerTitle += option.title ?? '';
            point += option.point as number;
          }
        }
        states['Q' + fid + '.AnswerTitle'] = quote(answerTitle);
        states['Q' + fid + '.Point'] = point;
        states['Q' + fid + '.PointWeigth'] = point * (readNumber(question.source, 'grade') as number);
        states['Q' + fid + '.SelectedCount'] = selectedCount;
        states['Q' + fid + '.AnswersCount'] = answerCount;
        break;
      }

      case FormQuestionTypesEnum.SkuCount: {
        const skuItems = Array.isArray(answer.value) ? answer.value : [];
        states['Q' + fid + '.Sum'] = skuItems.reduce((sum, item) =>
          sum + numericValue(readRecord(item)?.['total']), 0);
        break;
      }

      case FormQuestionTypesEnum.Matrix_MultiNumeric:
      case FormQuestionTypesEnum.Matrix_MultiShortText: {
        const matrixValues = readRecord(answer.value);
        if (isQuestionVisible) {
          for (const option of options) {
            if (!isOptionVisible(option.id, option.source)) continue;
            const raw = readFirstDefined(matrixValues, [
              option.id,
              option.uniqueIdPerForm ?? '',
              option.sourceId ?? '',
            ]);
            const hasValue = raw !== null && raw !== undefined && raw !== '';
            const suffix = question.questionType === FormQuestionTypesEnum.Matrix_MultiNumeric
              ? '.Number' : '.Text';
            states['Q' + fid + '.A' + compactFid(option.uniqueIdPerForm) + suffix] = hasValue
              ? question.questionType === FormQuestionTypesEnum.Matrix_MultiNumeric
                ? numericValue(raw)
                : raw
              : null;
          }
        }
        states['Q' + fid + '.AnswerTitle'] = quote('');
        break;
      }

      case FormQuestionTypesEnum.ShortText:
      case FormQuestionTypesEnum.LongText:
      case FormQuestionTypesEnum.Date:
      case FormQuestionTypesEnum.Time:
      case FormQuestionTypesEnum.Email:
      case FormQuestionTypesEnum.Mobile:
      case FormQuestionTypesEnum.NationalCode:
      case FormQuestionTypesEnum.Phone:
      case FormQuestionTypesEnum.PostalCode:
      case FormQuestionTypesEnum.CustomMaskShortText:
        states['Q' + fid + '.Text'] = quote(isQuestionVisible ? scalarText(answer.value) : '');
        break;

      case FormQuestionTypesEnum.Point:
      case FormQuestionTypesEnum.Rating:
      case FormQuestionTypesEnum.NPS:
        states['Q' + fid + '.Point'] = answer.value ? numericValue(answer.value) : 0;
        break;

      case FormQuestionTypesEnum.Numeric:
      case FormQuestionTypesEnum.Point_NumericScale:
        states['Q' + fid + '.Number'] = isQuestionVisible && answer.value
          ? numericValue(answer.value) : 0;
        states['Q' + fid + '.AnswerTitle'] = quote('');
        break;

      case FormQuestionTypesEnum.DynamicAnswer:
      case FormQuestionTypesEnum.RetailAudit:
      case FormQuestionTypesEnum.SkuCount_Dynamic:
      case FormQuestionTypesEnum.Chart:
        for (const field of readArrayOfRecords(question.source['dynamicDataFields'])) {
          const namespace = readString(field, 'nameSpace');
          if (namespace) {
            const key = '{{Q' + fid + '.Record.Data.' + namespace + '}}';
            states[key] = namespace + '.Value';
          }
        }
        break;

      case FormQuestionTypesEnum.RecordsOtherForms: {
        const jsonValues = readRecord(readRecord(answer.value)?.['jsonValuesDictionary']);
        const dynamicFields = readArrayOfRecords(question.source['dynamicDataFields']);
        if (jsonValues) {
          for (const [namespace, raw] of Object.entries(jsonValues)) {
            const field = dynamicFields.find((item) => item['nameSpace'] === namespace);
            if (!field) continue;
            states['Q' + fid + '.Data.' + namespace] = field['isNumeric'] === true
              ? numericValue(raw)
              : quote(raw === null || raw === undefined ? '' : String(raw));
          }
        }
        break;
      }

      case FormQuestionTypesEnum.Captcha:
        states['Q' + fid + '.Valid'] = answer.value ?? false;
        break;

      default:
        // The archived switch intentionally had no tokens for other question types.
        break;
    }
  }

  return Object.freeze({
    answerStates: Object.freeze(states),
    diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
  });
}

/** Splits the already-normalized legacy formula token list exactly on spaces. */
export function splitLegacyFormulaVariables(formula: string): readonly string[] {
  if (!formula) return Object.freeze([]);
  return Object.freeze(formula.split(' ')
    .map((token) => token.startsWith('@') || token.startsWith('#') ? token.slice(1) : token)
    .filter((token) => token.trim() !== ''));
}

/**
 * Applies global variables before answer-state tokens, matching LogicService order.
 * String values are safely quoted for the parser; this intentionally avoids the
 * legacy unescaped string-concatenation behavior.
 */
export function replaceLegacyFormulaValues(
  formula: string,
  variables: readonly string[],
  answerStates: Readonly<Record<string, unknown>>,
): { readonly formula: string; readonly missingVariables: readonly string[] } {
  let result = formula;
  const missing: string[] = [];
  for (const variable of variables) {
    if (!variable) continue;
    const marker = isWrappedLegacyToken(variable) ? variable : '@' + variable;
    if (!hasLegacyMarker(result, marker)) continue;
    if (!Object.prototype.hasOwnProperty.call(answerStates, variable)) missing.push(variable);
    const value = Object.prototype.hasOwnProperty.call(answerStates, variable)
      ? answerStates[variable]
      : null;
    result = replaceTokenWithWhitespace(result, marker, toAnswerStateFragment(value));
  }
  return Object.freeze({ formula: result, missingVariables: Object.freeze(missing) });
}

export function replaceLegacyGlobalVariables(
  formula: string,
  variables: readonly { readonly title: string; readonly result: unknown }[],
): string {
  let result = formula;
  for (const variable of variables) {
    const marker = '[%' + variable.title + '%]';
    result = replaceLegacyGlobalTokenOutsideStrings(
      result,
      marker,
      toFormulaLiteral(variable.result),
    );
  }
  return result;
}

export function replaceLegacyFormulaPipeline(
  formula: string,
  variables: readonly string[],
  answerStates: Readonly<Record<string, unknown>>,
  globalVariables: readonly { readonly title: string; readonly result: unknown }[] = [],
): { readonly formula: string; readonly missingVariables: readonly string[] } {
  const withGlobals = replaceLegacyGlobalVariables(formula, globalVariables);
  return replaceLegacyFormulaValues(withGlobals, variables, answerStates);
}

/**
 * The archived replaceGvarValues deliberately skips tokens inside quoted literals.
 * Keep that boundary without relying on a regex look-ahead whose behavior changes
 * when formulas contain escaped quotes.
 */
/**
 * The archived replaceGvarValues deliberately skips tokens inside quoted literals.
 * Keep that boundary without relying on a regex look-ahead whose behavior changes
 * when formulas contain escaped quotes.
 */
/**
 * The archived replaceGvarValues deliberately skips tokens inside quoted literals.
 * This scanner preserves that boundary and handles escaped quote characters.
 */
function replaceLegacyGlobalTokenOutsideStrings(
  formula: string,
  marker: string,
  replacement: string,
): string {
  let result = '';
  let index = 0;
  let quoteCharacter: "'" | '"' | null = null;
  const normalizedMarker = marker.toLowerCase();

  while (index < formula.length) {
    const character = formula[index];

    if (quoteCharacter) {
      result += character;
      if (character.charCodeAt(0) === 92) {
        const next = formula[index + 1];
        if (next !== undefined) {
          result += next;
          index += 2;
          continue;
        }
      } else if (character === quoteCharacter) {
        quoteCharacter = null;
      }
      index++;
      continue;
    }

    if (character === "'" || character === '"') {
      quoteCharacter = character;
      result += character;
      index++;
      continue;
    }

    let markerStart = index;
    while (markerStart < formula.length && formula[markerStart]?.trim() === '') markerStart++;
    const markerEnd = markerStart + marker.length;
    if (formula.slice(markerStart, markerEnd).toLowerCase() === normalizedMarker) {
      let replacementEnd = markerEnd;
      while (replacementEnd < formula.length && formula[replacementEnd]?.trim() === '') replacementEnd++;
      result += ' ' + replacement + ' ';
      index = replacementEnd;
      continue;
    }

    result += character;
    index++;
  }

  return result;
}

function optionToken(questionFid: string, optionFid?: string): string {
  return 'Q' + questionFid + '.A' + compactFid(optionFid);
}
function compactFid(value?: string): string {
  return value ? value.replace(/-/g, '') : '';
}
function quote(value: string): string {
  return JSON.stringify(value);
}
function toAnswerStateFragment(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'NaN';
  // Legacy answerStates already stores parser fragments (quoted strings, booleans,
  // numbers, null). Re-quoting a string here changes the formula's meaning.
  return String(value);
}
function toFormulaLiteral(value: unknown): string {
  if (typeof value === 'string') return quote(value);
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'NaN';
  return String(value);
}
function replaceTokenWithWhitespace(
  formula: string, marker: string, replacement: string, ignoreCase = false,
): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('\\s*' + escaped + '\\s*', ignoreCase ? 'gi' : 'g');
  return formula.replace(regex, () => ' ' + replacement + ' ');
}
function hasLegacyMarker(formula: string, marker: string): boolean {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\s*' + escaped + '\\s*').test(formula);
}
function isWrappedLegacyToken(value: string): boolean {
  return (value.startsWith('[%') && value.endsWith('%]')) ||
    (value.startsWith('{{') && value.endsWith('}}'));
}
function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function readArrayOfRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(readRecord).filter((item): item is Record<string, unknown> => !!item) : [];
}
function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length ? value : undefined;
}
function readNumber(record: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}
function readFirstDefined(
  record: Readonly<Record<string, unknown>> | undefined, keys: readonly string[],
): unknown {
  if (!record) return undefined;
  for (const key of keys) if (key && Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  return undefined;
}
function numericValue(value: unknown): number {
  return Number(value ?? '');
}
function scalarText(value: AnswerValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
function projectFieldValue(field: LegacyFormulaFieldValue): unknown {
  return field.isNumeric ? numericValue(field.value) : quote(field.value === null || field.value === undefined
    ? '' : String(field.value));
}
