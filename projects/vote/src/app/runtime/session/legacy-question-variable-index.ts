import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';

export interface LegacyQuestionVariableIndexDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface LegacyQuestionVariableIndex {
  /** Keyed by the archived question.uniqueId (definition sourceId). */
  readonly variablesByQuestionSourceId: Readonly<Record<string, readonly string[]>>;
  readonly diagnostics: readonly LegacyQuestionVariableIndexDiagnostic[];
}

/**
 * Rebuilds the archived questionsHasVariable index from the immutable definition.
 * Field order and token matching follow the old initialize-question pass.
 */
export function createLegacyQuestionVariableIndex(
  definition: SurveyDefinition,
): LegacyQuestionVariableIndex {
  const index: Record<string, readonly string[]> = Object.create(null);
  const diagnostics: LegacyQuestionVariableIndexDiagnostic[] = [];

  for (const question of definition.questions) {
    const variables: string[] = [];
    const seen = new Set<string>();
    const addFromText = (value: string | null | undefined) => {
      if (!value) return;
      for (const match of value.match(/\[%\w+%\]/g) ?? []) {
        if (seen.has(match)) continue;
        seen.add(match);
        variables.push(match);
      }
    };

    addFromText(question.title);
    addFromText(question.description);

    if (question.initialValue && question.source['hasInitialValue'] === true) {
      addFromText(question.initialValue);
    }

    addFromText(readString(question.source, 'secondaryFilterValue'));

    if (usesLegacyOptionTitleVariables(question.questionType)) {
      for (const option of question.options) addFromText(option.title);
    }

    if (!variables.length) continue;
    if (!question.sourceId) {
      diagnostics.push({
        code: 'LEGACY_QUESTION_VARIABLE_SOURCE_ID_MISSING',
        path: question.id,
        message: 'The legacy questionsHasVariable index is keyed by question.uniqueId.',
      });
      continue;
    }
    index[question.sourceId] = Object.freeze(variables);
  }

  return Object.freeze({
    variablesByQuestionSourceId: Object.freeze(index),
    diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
  });
}

function usesLegacyOptionTitleVariables(type: FormQuestionTypesEnum | undefined): boolean {
  switch (type) {
    case FormQuestionTypesEnum.UniqueSelect:
    case FormQuestionTypesEnum.Dropdown:
    case FormQuestionTypesEnum.Matrix_Checkbox:
    case FormQuestionTypesEnum.Matrix_Radio:
    case FormQuestionTypesEnum.Matrix_MultiNumeric:
    case FormQuestionTypesEnum.Matrix_MultiShortText:
    case FormQuestionTypesEnum.SkuCount:
    case FormQuestionTypesEnum.MultiSelect:
    case FormQuestionTypesEnum.HasPriority:
    case FormQuestionTypesEnum.Emoji:
    case FormQuestionTypesEnum.MultiSelectWithImageOptions:
    case FormQuestionTypesEnum.UniqueSelectWithImageOptions:
      return true;
    default:
      return false;
  }
}

function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
