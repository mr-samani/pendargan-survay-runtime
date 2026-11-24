import { FormQuestionTypesEnum } from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import { createLegacyQuestionVariableIndex } from './legacy-question-variable-index';
import {
  applyLegacyGlobalVariableEffectBatchToState,
  buildLegacyGlobalVariableEffectBatch,
} from './legacy-global-variable-dispatcher';

function question(
  id: string,
  type: FormQuestionTypesEnum,
  values: Partial<SurveyQuestionDefinition> = {},
): SurveyQuestionDefinition {
  return {
    id,
    sourceId: id + '-source',
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
function definition(
  questions: readonly SurveyQuestionDefinition[],
  variables = [{ id: 'var-name', title: 'name', expression: 'true', isActive: true, source: {} }],
): SurveyDefinition {
  return {
    id: 'survey',
    sections: [],
    questions,
    expressions: [],
    globalVariables: variables,
  };
}

describe('buildLegacyGlobalVariableEffectBatch', () => {
  it('turns changed initial values into answer commands scoped to the active instance', () => {
    const q = question('name', FormQuestionTypesEnum.ShortText, {
      initialValue: 'Hello [%name%]',
      source: { hasInitialValue: true },
    });
    const survey = definition([q]);
    const index = createLegacyQuestionVariableIndex(survey);
    const batch = buildLegacyGlobalVariableEffectBatch(
      survey, index, [{ id: 'var-name', value: 'Sara' }], {}, 'loop:section:2',
    );
    expect(batch.changedVariableIds).toEqual(['var-name']);
    expect(batch.answerCommands).toEqual([{
      type: 'set-value',
      instanceId: 'loop:section:2',
      questionId: 'name',
      value: 'Hello Sara',
    }]);
    expect(batch.questionsToRecalculate).toEqual(['name']);
  });

  it('does not reapply effects when a global variable result is unchanged', () => {
    const q = question('name', FormQuestionTypesEnum.ShortText, {
      initialValue: 'Hello [%name%]',
      source: { hasInitialValue: true },
    });
    const survey = definition([q]);
    const batch = buildLegacyGlobalVariableEffectBatch(
      survey, createLegacyQuestionVariableIndex(survey),
      [{ id: 'var-name', value: 'Sara' }], { 'var-name': 'Sara' }, 'root',
    );
    expect(batch.changedVariableIds).toEqual([]);
    expect(batch.answerCommands).toEqual([]);
    expect(batch.questionsToRecalculate).toEqual([]);
  });

  it('projects Payment amount separately from the answer value', () => {
    const q = question('payment', FormQuestionTypesEnum.Payment, {
      initialValue: '[%name%]',
      source: { hasInitialValue: true },
    });
    const survey = definition([q]);
    const batch = buildLegacyGlobalVariableEffectBatch(
      survey, createLegacyQuestionVariableIndex(survey),
      [{ id: 'var-name', value: '125' }], {}, 'root',
    );
    expect(batch.answerCommands).toEqual([]);
    expect(batch.paymentAmountOverrides).toEqual([{ questionId: 'payment', amount: 125 }]);
    expect(batch.questionsToRecalculate).toEqual(['payment']);
  });

  it('emits dynamic secondary-filter updates and recalculation requests', () => {
    const q = question('sku', FormQuestionTypesEnum.SkuCount_Dynamic, {
      source: {
        secondaryFilterValue: 'category=[%name%]',
        secondaryFieldValueFilter: 'category=old',
      },
    });
    const survey = definition([q]);
    const batch = buildLegacyGlobalVariableEffectBatch(
      survey, createLegacyQuestionVariableIndex(survey),
      [{ id: 'var-name', value: 'food' }], {}, 'root',
    );
    expect(batch.secondaryFilterUpdates).toEqual([{
      questionId: 'sku', value: 'category=food',
    }]);
    expect(batch.questionsToRecalculate).toEqual(['sku']);
  });

  it('preserves recalculation but suppresses secondary-filter refresh during reset', () => {
    const q = question('sku', FormQuestionTypesEnum.RetailAudit, {
      source: { secondaryFilterValue: 'category=[%name%]' },
    });
    const survey = definition([q]);
    const batch = buildLegacyGlobalVariableEffectBatch(
      survey, createLegacyQuestionVariableIndex(survey),
      [{ id: 'var-name', value: 'food' }], {}, 'root', true,
    );
    expect(batch.secondaryFilterUpdates).toEqual([]);
    expect(batch.questionsToRecalculate).toEqual(['sku']);
  });

  it('ignores unknown and inactive global variables', () => {
    const q = question('name', FormQuestionTypesEnum.ShortText, {
      initialValue: '[%name%]', source: { hasInitialValue: true },
    });
    const survey = definition([q], [
      { id: 'inactive', title: 'name', expression: 'true', isActive: false, source: {} },
    ]);
    const batch = buildLegacyGlobalVariableEffectBatch(
      survey, createLegacyQuestionVariableIndex(survey),
      [{ id: 'inactive', value: 'ignored' }, { id: 'missing', value: 'ignored' }],
      {}, 'root',
    );
    expect(batch.changedVariableIds).toEqual([]);
    expect(batch.answerCommands).toEqual([]);
  });
  it('can move a secondary filter back to its original value after an earlier update', () => {
    const q = question('sku', FormQuestionTypesEnum.SkuCount_Dynamic, {
      source: {
        secondaryFilterValue: 'category=[%name%]',
        secondaryFieldValueFilter: 'category=old',
      },
    });
    const survey = definition([q]);
    const index = createLegacyQuestionVariableIndex(survey);
    const first = buildLegacyGlobalVariableEffectBatch(
      survey, index, [{ id: 'var-name', value: 'food' }], {}, 'root',
    );
    const state = applyLegacyGlobalVariableEffectBatchToState(undefined, first);
    expect(state.secondaryFilters['sku']).toBe('category=food');

    const second = buildLegacyGlobalVariableEffectBatch(
      survey, index, [{ id: 'var-name', value: 'old' }], { 'var-name': 'food' },
      'root', false, undefined, state,
    );
    expect(second.secondaryFilterUpdates).toEqual([{
      questionId: 'sku', value: 'category=old',
    }]);
    expect(applyLegacyGlobalVariableEffectBatchToState(state, second).secondaryFilters['sku'])
      .toBe('category=old');
  });

});
