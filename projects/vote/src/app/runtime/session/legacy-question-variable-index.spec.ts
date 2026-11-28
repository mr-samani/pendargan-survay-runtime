import { FormQuestionTypesEnum } from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import { createLegacyQuestionVariableIndex } from './legacy-question-variable-index';

function question(
  id: string,
  sourceId: string | undefined,
  type: FormQuestionTypesEnum,
  values: Partial<SurveyQuestionDefinition> = {},
): SurveyQuestionDefinition {
  return {
    id,
    sourceId,
    uniqueIdPerForm: id + '-fid',
    questionType: type,
    source: {},
    isActive: true,
    isRequired: false,
    settings: null,
    options: [],
    ...values,
  };
}
function definition(questions: readonly SurveyQuestionDefinition[]): SurveyDefinition {
  return {
    id: 'variable-index-test',
    sections: [],
    questions,
    expressions: [],
    globalVariables: [],
  };
}

describe('createLegacyQuestionVariableIndex', () => {
  it('collects title, description, initial value, secondary filter and option titles in legacy order', () => {
    const q = question('q1', 'question-db-id', FormQuestionTypesEnum.UniqueSelect, {
      title: 'Hi [%name%]',
      description: 'Desc [%age%] and [%name%]',
      initialValue: 'prefix [%name%] [%region%]',
      source: { hasInitialValue: true, secondaryFilterValue: 'secondary [%city%]' },
      options: [{
        id: 'option-1', uniqueIdPerForm: 'o1', title: 'Option [%opt%]',
        source: {}, settings: null,
      }],
    });
    const result = createLegacyQuestionVariableIndex(definition([q]));
    expect(result.variablesByQuestionSourceId['question-db-id']).toEqual([
      '[%name%]', '[%age%]', '[%region%]', '[%city%]', '[%opt%]',
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('does not collect initial values when hasInitialValue is false or option titles for unsupported types', () => {
    const q = question('q2', 'question-db-2', FormQuestionTypesEnum.ShortText, {
      initialValue: '[%initial%]',
      source: { hasInitialValue: false },
      options: [{
        id: 'option-2', uniqueIdPerForm: 'o2', title: '[%option%]',
        source: {}, settings: null,
      }],
    });
    const result = createLegacyQuestionVariableIndex(definition([q]));
    expect(result.variablesByQuestionSourceId).toEqual({});
  });

  it('collects secondary filters independently of question type', () => {
    const q = question('q3', 'question-db-3', FormQuestionTypesEnum.ShortText, {
      source: { secondaryFilterValue: '[%region%]' },
    });
    const result = createLegacyQuestionVariableIndex(definition([q]));
    expect(result.variablesByQuestionSourceId['question-db-3']).toEqual(['[%region%]']);
  });

  it('matches only the archived word-character placeholder pattern', () => {
    const q = question('q4', 'question-db-4', FormQuestionTypesEnum.ShortText, {
      title: '[%valid_name2%] [%not-valid-name%] [%with.dot%]',
    });
    const result = createLegacyQuestionVariableIndex(definition([q]));
    expect(result.variablesByQuestionSourceId['question-db-4']).toEqual(['[%valid_name2%]']);
  });

  it('reports a missing source question id instead of indexing under a fabricated key', () => {
    const q = question('q5', undefined, FormQuestionTypesEnum.ShortText, {
      title: '[%name%]',
    });
    const result = createLegacyQuestionVariableIndex(definition([q]));
    expect(result.variablesByQuestionSourceId).toEqual({});
    expect(result.diagnostics).toMatchObject([
      { code: 'LEGACY_QUESTION_VARIABLE_SOURCE_ID_MISSING', path: 'q5' },
    ]);
  });
});
