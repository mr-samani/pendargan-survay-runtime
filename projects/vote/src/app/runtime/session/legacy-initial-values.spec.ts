import { FormQuestionTypesEnum } from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import { addAnswerInstance, createInitialAnswerState } from '../state/answer-state.reducer';
import { initializeLegacyQuestionInitialValues } from './legacy-initial-values';

function makeQuestion(
  id: string,
  type: FormQuestionTypesEnum,
  initialValue: string | undefined,
  hasInitialValue: boolean,
  isActive = true,
): SurveyQuestionDefinition {
  return {
    id,
    sourceId: id + '-source',
    uniqueIdPerForm: id + '-fid',
    questionType: type,
    source: { hasInitialValue },
    isActive,
    isRequired: false,
    initialValue,
    settings: null,
    options: [],
  };
}
function makeDefinition(questions: readonly SurveyQuestionDefinition[]): SurveyDefinition {
  return {
    id: 'survey',
    sections: [],
    questions,
    expressions: [],
    globalVariables: [],
  };
}

describe('initializeLegacyQuestionInitialValues', () => {
  it('hydrates configured initial values before the first formula projection', () => {
    const definition = makeDefinition([
      makeQuestion('name', FormQuestionTypesEnum.ShortText, 'Mohammad', true),
      makeQuestion('amount', FormQuestionTypesEnum.Numeric, '42', true),
      makeQuestion('unconfigured', FormQuestionTypesEnum.ShortText, 'ignored', false),
    ]);
    const initial = createInitialAnswerState(definition);
    const result = initializeLegacyQuestionInitialValues(definition, initial);

    expect(result.applied).toBe(true);
    expect(result.state.revision).toBe(1);
    expect(result.state.instances['root']['name'].value).toBe('Mohammad');
    expect(result.state.instances['root']['amount'].value).toBe('42');
    expect(result.state.instances['root']['unconfigured'].value).toBeNull();
    expect(result.state.instances['root']['name'].isDirty).toBe(false);
  });

  it('starts unresolved global-variable initial values as an empty string', () => {
    const definition = makeDefinition([
      makeQuestion('name', FormQuestionTypesEnum.ShortText, '[%first_name%] [%last_name%]', true),
    ]);
    const result = initializeLegacyQuestionInitialValues(
      definition, createInitialAnswerState(definition),
    );
    expect(result.state.instances['root']['name'].value).toBe('');
  });

  it('ignores inactive questions, empty initial values, and Group questions', () => {
    const definition = makeDefinition([
      makeQuestion('inactive', FormQuestionTypesEnum.ShortText, 'ignored', true, false),
      makeQuestion('empty', FormQuestionTypesEnum.ShortText, '', true),
      makeQuestion('group', FormQuestionTypesEnum.Group, 'child-a,child-b', true),
    ]);
    const result = initializeLegacyQuestionInitialValues(
      definition, createInitialAnswerState(definition),
    );
    expect(result.state.revision).toBe(0);
    expect(result.changedAnswers).toEqual([]);
    expect(result.state.instances['root']['inactive'].value).toBeNull();
    expect(result.state.instances['root']['empty'].value).toBeNull();
    expect(result.state.instances['root']['group'].value).toBeNull();
  });

  it('rejects an unknown answer instance without mutating the snapshot', () => {
    const definition = makeDefinition([
      makeQuestion('name', FormQuestionTypesEnum.ShortText, 'Mohammad', true),
    ]);
    const initial = createInitialAnswerState(definition);
    const result = initializeLegacyQuestionInitialValues(definition, initial, 'loop:missing');
    expect(result.applied).toBe(false);
    expect(result.state).toBe(initial);
    expect(result.diagnostics[0].code).toBe('LEGACY_INITIAL_VALUES_INSTANCE_UNKNOWN');
  });

  it('does not mutate the immutable definition or original answer snapshot', () => {
    const definition = makeDefinition([
      makeQuestion('name', FormQuestionTypesEnum.ShortText, 'Mohammad', true),
    ]);
    const initial = createInitialAnswerState(definition);
    initializeLegacyQuestionInitialValues(definition, initial);
    expect(initial.instances['root']['name'].value).toBeNull();
    expect(definition.questions[0].initialValue).toBe('Mohammad');
  });
  it('initializes only questions owned by a repeated-section answer instance', () => {
    const inside = {
      ...makeQuestion('inside', FormQuestionTypesEnum.ShortText, 'inside-value', true),
      formSectionUniqueId: 'section-fid',
    };
    const outside = {
      ...makeQuestion('outside', FormQuestionTypesEnum.ShortText, 'outside-value', true),
      formSectionUniqueId: 'other-section-fid',
    };
    const definition = makeDefinition([inside, outside]);
    const root = createInitialAnswerState(definition);
    const loop = addAnswerInstance(root, definition, 'loop:section:1', ['inside']);
    expect(loop.applied).toBe(true);
    const initialized = initializeLegacyQuestionInitialValues(
      definition, loop.state, 'loop:section:1',
    );
    expect(initialized.applied).toBe(true);
    expect(initialized.state.instances['loop:section:1']['inside'].value).toBe('inside-value');
    expect(initialized.state.instances['loop:section:1']['outside']).toBeUndefined();
  });

});
