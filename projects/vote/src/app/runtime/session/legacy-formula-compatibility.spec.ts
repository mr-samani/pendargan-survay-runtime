import { FormQuestionTypesEnum } from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyFormulaEvaluationContext } from './concrete-runtime-projector';
import type { SurveyDefinition, SurveyQuestionDefinition, SurveyOptionDefinition } from '../definition/definition.types';
import { createInitialAnswerState } from '../state/answer-state.reducer';
import {
  createLegacyFormulaAnswerStates,
  replaceLegacyFormulaPipeline,
  splitLegacyFormulaVariables,
} from './legacy-formula-compatibility';

function option(id: string, point = 0, title = id): SurveyOptionDefinition {
  return {
    id, uniqueIdPerForm: id + '-fid', sourceId: id + '-source', title, point,
    source: {}, settings: null,
  };
}
function question(
  id: string,
  questionType: FormQuestionTypesEnum,
  options: readonly SurveyOptionDefinition[] = [],
  source: Record<string, unknown> = {},
): SurveyQuestionDefinition {
  return {
    id, uniqueIdPerForm: id + '-fid', questionType, options, source,
    isActive: true, isRequired: false, settings: null,
  };
}
function makeContext(
  questions: readonly SurveyQuestionDefinition[],
  answers: Readonly<Record<string, { value?: any; selectedOptionIds?: readonly string[] }>> = {},
): SurveyFormulaEvaluationContext {
  const definition: SurveyDefinition = {
    id: 'legacy-formula-test',
    sections: [],
    questions,
    expressions: [],
    globalVariables: [],
  };
  const initial = createInitialAnswerState(definition);
  const instance = { ...initial.instances['root'] };
  for (const item of questions) {
    const supplied = answers[item.id] ?? {};
    instance[item.id] = Object.freeze({
      ...instance[item.id],
      value: supplied.value ?? null,
      selectedOptionIds: Object.freeze([...(supplied.selectedOptionIds ?? [])]),
    });
  }
  const answerState = Object.freeze({
    ...initial,
    instances: Object.freeze({ root: Object.freeze(instance) }),
  });
  return {
    definition,
    answers: answerState,
    instanceId: 'root',
    loopVariables: Object.freeze({}),
  } as unknown as SurveyFormulaEvaluationContext;
}

describe('legacy formula compatibility adapter', () => {
  it('projects single-choice flags, visible option counts, title, points and weighted points', () => {
    const q = question('single', FormQuestionTypesEnum.UniqueSelect, [
      option('opt-a', 3, 'Alpha'), option('opt-b', 7, 'Beta'), option('opt-c', 11, 'Hidden'),
    ], { grade: 2 });
    const context = makeContext([q], { single: { selectedOptionIds: ['opt-b'] } });
    const result = createLegacyFormulaAnswerStates(context, {
      visibility: { optionVisibility: { 'opt-c': false } },
    });
    expect(result.answerStates).toMatchObject({
      'Qsinglefid.Aoptafid': false,
      'Qsinglefid.Aoptbfid': true,
      'Qsinglefid.Aoptcfid': false,
      'Qsinglefid.AnswerTitle': '"Beta"',
      'Qsinglefid.Point': 7,
      'Qsinglefid.PointWeigth': 14,
      'Qsinglefid.SelectedCount': 1,
      'Qsinglefid.AnswersCount': 2,
    });
  });

  it('projects multi-select aggregates and suppresses selected flags for hidden questions', () => {
    const q = question('multi', FormQuestionTypesEnum.MultiSelect, [
      option('a', 2, 'A'), option('b', 5, 'B'),
    ], { grade: 3 });
    const context = makeContext([q], { multi: { selectedOptionIds: ['a', 'b'] } });
    const visible = createLegacyFormulaAnswerStates(context);
    expect(visible.answerStates['Qmultifid.AnswerTitle']).toBe('"A, B"');
    expect(visible.answerStates['Qmultifid.Point']).toBe(7);
    expect(visible.answerStates['Qmultifid.PointWeigth']).toBe(21);
    const hidden = createLegacyFormulaAnswerStates(context, {
      visibility: { questionVisibility: { multi: false } },
    });
    expect(hidden.answerStates['Qmultifid.Aafid']).toBe(false);
    expect(hidden.answerStates['Qmultifid.SelectedCount']).toBe(0);
    expect(hidden.answerStates['Qmultifid.AnswersCount']).toBe(2);
  });

  it('projects scalar text and numeric tokens with the archived hidden-question defaults', () => {
    const text = question('text', FormQuestionTypesEnum.ShortText);
    const numeric = question('number', FormQuestionTypesEnum.Numeric);
    const context = makeContext([text, numeric], {
      text: { value: 'hello' }, number: { value: 42 },
    });
    const visible = createLegacyFormulaAnswerStates(context);
    expect(visible.answerStates['Qtextfid.Text']).toBe('"hello"');
    expect(visible.answerStates['Qnumberfid.Number']).toBe(42);
    const hidden = createLegacyFormulaAnswerStates(context, {
      visibility: { questionVisibility: { text: false, number: false } },
    });
    expect(hidden.answerStates['Qtextfid.Text']).toBe('""');
    expect(hidden.answerStates['Qnumberfid.Number']).toBe(0);
    expect(hidden.answerStates['Qnumberfid.AnswerTitle']).toBe('""');
  });

  it('projects matrix numeric and text cells and emits null for empty cells', () => {
    const numeric = question('matrix-n', FormQuestionTypesEnum.Matrix_MultiNumeric, [
      option('row-a'), option('row-b'),
    ]);
    const text = question('matrix-t', FormQuestionTypesEnum.Matrix_MultiShortText, [
      option('row-c'),
    ]);
    const context = makeContext([numeric, text], {
      'matrix-n': { value: { 'row-a': '12.5', 'row-b': '' } },
      'matrix-t': { value: { 'row-c': 'comment' } },
    });
    const result = createLegacyFormulaAnswerStates(context);
    expect(result.answerStates['Qmatrixnfid.Arowafid.Number']).toBe(12.5);
    expect(result.answerStates['Qmatrixnfid.Arowbfid.Number']).toBeNull();
    expect(result.answerStates['Qmatrixtfid.Arowcfid.Text']).toBe('comment');
  });

  it('projects SKU sums and dynamic-answer filter placeholders', () => {
    const sku = question('sku', FormQuestionTypesEnum.SkuCount);
    const dynamic = question('dynamic', FormQuestionTypesEnum.DynamicAnswer, [], {
      dynamicDataFields: [{ nameSpace: 'price' }, { nameSpace: 'category' }],
    });
    const context = makeContext([sku, dynamic], {
      sku: { value: [{ total: '2' }, { total: 3 }] },
    });
    const result = createLegacyFormulaAnswerStates(context);
    expect(result.answerStates['Qskufid.Sum']).toBe(5);
    expect(result.answerStates['{{Qdynamicfid.Record.Data.price}}']).toBe('price.Value');
    expect(result.answerStates['{{Qdynamicfid.Record.Data.category}}']).toBe('category.Value');
  });

  it('projects RecordsOtherForms fields according to each field numeric flag', () => {
    const q = question('records', FormQuestionTypesEnum.RecordsOtherForms, [], {
      dynamicDataFields: [
        { nameSpace: 'age', isNumeric: true },
        { nameSpace: 'displayName', isNumeric: false },
      ],
    });
    const context = makeContext([q], {
      records: { value: { jsonValuesDictionary: { age: '34', displayName: 'Sam' } } },
    });
    const result = createLegacyFormulaAnswerStates(context);
    expect(result.answerStates['Qrecordsfid.Data.age']).toBe(34);
    expect(result.answerStates['Qrecordsfid.Data.displayName']).toBe('"Sam"');
  });

  it('projects region, demographic and system fields without mutating canonical answers', () => {
    const q = question('text', FormQuestionTypesEnum.ShortText);
    const context = makeContext([q], { text: { value: 'unchanged' } });
    const result = createLegacyFormulaAnswerStates(context, {
      lastRegionChildId: 'a1-b2',
      demographyFields: [{ namespace: 'age', value: '28', isNumeric: true }],
      systemFields: [{ namespace: 'city', value: 'Tehran', isNumeric: false }],
    });
    expect(result.answerStates['Region.UniqueId']).toBe('"a1b2"');
    expect(result.answerStates['Demography.Data.age']).toBe(28);
    expect(result.answerStates['System.city']).toBe('"Tehran"');
    expect(context.answers.instances['root']['text'].value).toBe('unchanged');
  });

  it('replaces global variables before answer variables and reports missing tokens', () => {
    const states = Object.freeze({ 'Qx.Text': '"answer"' });
    const formula = ' [%Amount%] > 10 && @Qx.Text == "answer" && @Missing > 0 ';
    const result = replaceLegacyFormulaPipeline(
      formula,
      ['[%Amount%]', 'Qx.Text', 'Missing'],
      states,
      [{ title: 'amount', result: 20 }],
    );
    expect(result.formula).toContain('20');
    expect(result.formula).toContain('"answer"');
    expect(result.formula).toContain('null');
    expect(result.missingVariables).toEqual(['Missing']);
  });

  it('retains the legacy # dependency-token normalization edge case', () => {
    expect(splitLegacyFormulaVariables('#Qx.Text @Qy.Text')).toEqual(['Qx.Text', 'Qy.Text']);
    const result = replaceLegacyFormulaPipeline('#Qx.Text == "x"', ['Qx.Text'], {
      'Qx.Text': '"x"',
    });
    expect(result.formula).toContain('#Qx.Text');
  });
});
