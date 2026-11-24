import {
  type GetAllFormDetailForViewOutputDto,
  type GetFormQuestionQuestionOptionDto,
  type GetQuestionOptionDto,
  type GetFormSectionDto,
  type GetFormExpressionDto,
  type GetFormGlobalVariableDto,
} from '@service-proxies/models';
import type {
  DefinitionDiagnostic,
  SurveyDefinition,
  SurveyDefinitionCompilation,
  SurveyExpressionDefinition,
  SurveyGlobalVariableDefinition,
  SurveyOptionDefinition,
  SurveyQuestionDefinition,
  SurveySectionDefinition,
} from './definition.types';

type JsonRecord = Readonly<Record<string, unknown>>;

/**
 * Compiles the API response into a detached, immutable definition snapshot.
 *
 * This function deliberately does not evaluate expressions, create runtime answers,
 * load renderers, or infer missing section/loop semantics. Those belong to later
 * runtime layers. Generated service-proxy DTOs remain untouched.
 */
export function compileSurveyDefinition(
  response: GetAllFormDetailForViewOutputDto,
): SurveyDefinitionCompilation {
  const diagnostics: DefinitionDiagnostic[] = [];

  const sections = stableSort(
    (response.formSections ?? []).map((section, index) =>
      compileSection(section, index, diagnostics),
    ),
    (a, b) => compareOptionalNumber(a.firstQuestionSortKey, b.firstQuestionSortKey),
  );

  const questions = stableSort(
    (response.formQuestions ?? []).map((question, index) =>
      compileQuestion(question, index, diagnostics),
    ),
    (a, b) => compareOptionalNumber(a.sortKey, b.sortKey),
  );

  const expressions = (response.formExpressions ?? []).map((expression, index) =>
    compileExpression(expression, index, diagnostics),
  );

  const globalVariables = (response.formGlobalVariables ?? []).map((variable, index) =>
    compileGlobalVariable(variable, index, diagnostics),
  );

  addDuplicateDiagnostics('section', sections, diagnostics);
  addDuplicateDiagnostics('question', questions, diagnostics);
  addDuplicateDiagnostics('option', questions.flatMap((question) => question.options), diagnostics);
  addDuplicateDiagnostics('expression', expressions, diagnostics);
  addDuplicateDiagnostics('global-variable', globalVariables, diagnostics);

  const id = response.formGuid || 'survey';
  if (!response.formGuid) {
    diagnostics.push({
      code: 'SURVEY_ID_FALLBACK',
      severity: 'warning',
      path: 'formGuid',
      message: 'The API response has no formGuid; a snapshot-local fallback ID was used.',
    });
  }

  const definition: SurveyDefinition = deepFreeze({
    id,
    formGuid: response.formGuid,
    canSubmit: response.canSubmit,
    sections,
    questions,
    expressions,
    globalVariables,
  });

  return deepFreeze({
    definition,
    diagnostics,
    isValid: !diagnostics.some((item) => item.severity === 'error'),
  });
}

function compileSection(
  source: GetFormSectionDto,
  index: number,
  diagnostics: DefinitionDiagnostic[],
): SurveySectionDefinition {
  const id = resolveId(
    source.uniqueIdPerForm,
    source.uniqueId,
    'section:' + index,
    'formSections[' + index + ']',
    diagnostics,
  );

  return {
    id,
    source: snapshotSource(source),
    sourceId: source.uniqueId,
    uniqueIdPerForm: source.uniqueIdPerForm,
    title: source.title,
    type: source.type,
    firstQuestionSortKey: source.firstQuestionSortKey,
    loopNumber: source.loopNumber,
    isPopUp: source.isPopUp,
  };
}

function compileQuestion(
  source: GetFormQuestionQuestionOptionDto,
  index: number,
  diagnostics: DefinitionDiagnostic[],
): SurveyQuestionDefinition {
  const path = 'formQuestions[' + index + ']';
  const id = resolveId(
    source.uniqueIdPerForm,
    source.uniqueId,
    'question:' + index,
    path,
    diagnostics,
  );

  if (source.questionType == null) {
    diagnostics.push({
      code: 'QUESTION_TYPE_MISSING',
      severity: 'error',
      path: path + '.questionType',
      message: 'A question type is required to select its renderer.',
    });
  }

  const options = stableSort(
    (source.questionOptions ?? []).map((option, optionIndex) =>
      compileOption(option, id, optionIndex, diagnostics, path),
    ),
    (a, b) => compareOptionalNumber(a.rowNumber, b.rowNumber),
  );

  return {
    id,
    source: snapshotSource(source),
    sourceId: source.uniqueId,
    uniqueIdPerForm: source.uniqueIdPerForm,
    questionType: source.questionType,
    formSectionUniqueId: source.formSectionUniqueId,
    parentUniqueId: source.parentUniqueId,
    sortKey: source.sortKey,
    childSortKey: source.childSortKey,
    title: source.title,
    description: source.description,
    isActive: source.isActive === true,
    isRequired: source.isRequired === true,
    isHTML: source.isHTML,
    settings: freezeSettings(source.settings),
    additionalSettings: source.additionalSettings,
    initialValue: source.initialValue,
    minimumAnswer: source.minimumAnswer,
    maximumAnswer: source.maximumAnswer,
    decimalStep: source.decimalStep,
    options,
  };
}

function compileOption(
  source: GetQuestionOptionDto,
  questionId: string,
  index: number,
  diagnostics: DefinitionDiagnostic[],
  questionPath: string,
): SurveyOptionDefinition {
  const path = questionPath + '.questionOptions[' + index + ']';
  const id = resolveId(
    source.uniqueIdPerForm,
    source.uniqueId,
    questionId + ':option:' + index,
    path,
    diagnostics,
  );

  return {
    id,
    source: snapshotSource(source),
    sourceId: source.uniqueId,
    uniqueIdPerForm: source.uniqueIdPerForm,
    title: source.title,
    rowNumber: source.rowNumber,
    point: source.point,
    isExclusive: source.isExclusive,
    isDefault: source.isDefault,
    manualCode: source.manualCode,
    dimensionUniqueId: source.dimensionUniqueId,
    requiredDescription: source.requiredDescription,
    descriptionType: source.descriptionType,
    descriptionPlaceholder: source.descriptionPlaceholder,
    settings: freezeSettings(source.settings),
    additionalSettings: source.additionalSettings,
  };
}

function compileExpression(
  source: GetFormExpressionDto,
  index: number,
  diagnostics: DefinitionDiagnostic[],
): SurveyExpressionDefinition {
  const id = resolveId(
    source.uniqueId,
    undefined,
    'expression:' + index,
    'formExpressions[' + index + ']',
    diagnostics,
  );

  return {
    id,
    source: snapshotSource(source),
    sourceId: source.uniqueId,
    expressionText: source.expressionText ?? '',
    designerCode: source.designerCode,
    targetType: source.targetType,
    targetKey: source.targetKey,
    actionType: source.actionType,
    formQuestionUniqueId: source.formQuestionUniqueId,
    formExpressionType: source.formExpressionType,
    isActive: source.isActive === true,
    isUserDefined: source.isUserDefined,
    reachMaxCount: source.reachMaxCount,
    remainedPercent: source.remainedPercent,
    remainedCount: source.remainedCount,
  };
}

function compileGlobalVariable(
  source: GetFormGlobalVariableDto,
  index: number,
  diagnostics: DefinitionDiagnostic[],
): SurveyGlobalVariableDefinition {
  const id = resolveId(
    source.uniqueIdPerForm,
    source.uniqueId,
    'global-variable:' + index,
    'formGlobalVariables[' + index + ']',
    diagnostics,
  );

  return {
    id,
    source: snapshotSource(source),
    sourceId: source.uniqueId,
    uniqueIdPerForm: source.uniqueIdPerForm,
    title: source.title ?? '',
    expression: source.expression ?? '',
    designerCode: source.designerCode,
    formQuestionUniqueId: source.formQuestionUniqueId,
    type: source.type,
    isActive: source.isActive === true,
    isUserDefined: source.isUserDefined,
    isSystemVariable: source.isSystemVariable,
  };
}

function resolveId(
  preferred: string | undefined,
  fallback: string | undefined,
  generated: string,
  path: string,
  diagnostics: DefinitionDiagnostic[],
): string {
  const id = preferred || fallback;
  if (id) return id;

  diagnostics.push({
    code: 'DEFINITION_ID_FALLBACK',
    severity: 'warning',
    path,
    message: 'No stable API identifier was supplied; "' + generated + '" is only stable within this response snapshot.',
  });
  return generated;
}

function addDuplicateDiagnostics<T extends { readonly id: string }>(
  kind: string,
  items: readonly T[],
  diagnostics: DefinitionDiagnostic[],
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      diagnostics.push({
        code: 'DUPLICATE_DEFINITION_ID',
        severity: 'error',
        path: kind,
        message: 'Duplicate ' + kind + ' ID "' + item.id + '".',
      });
    } else {
      seen.add(item.id);
    }
  }
}

function compareOptionalNumber(a: number | null | undefined, b: number | null | undefined): number {
  const left = a ?? Number.MAX_SAFE_INTEGER;
  const right = b ?? Number.MAX_SAFE_INTEGER;
  return left - right;
}

function stableSort<T>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
): T[] {
  return items
    .map((value, index) => ({ value, index }))
    .sort((a, b) => compare(a.value, b.value) || a.index - b.index)
    .map(({ value }) => value);
}

function snapshotSource(value: object): JsonRecord {
  const serializable =
    typeof (value as { toJSON?: () => unknown }).toJSON === 'function'
      ? (value as { toJSON: () => unknown }).toJSON()
      : value;
  return deepFreeze(cloneJsonValue(serializable)) as JsonRecord;
}

function freezeSettings(
  value: { [key: string]: unknown } | null | undefined,
): JsonRecord | null {
  if (value == null) return null;
  return deepFreeze(cloneJsonValue(value)) as JsonRecord;
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T;
  }

  if (value !== null && typeof value === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = cloneJsonValue(item);
    }
    return clone as T;
  }

  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}
