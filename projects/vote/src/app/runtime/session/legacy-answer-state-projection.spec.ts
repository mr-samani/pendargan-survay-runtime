import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import type { QuestionAnswerState } from '../state/answer-state.types';
import { projectCanonicalAnswerToLegacy } from './legacy-answer-state-projection';

const question = (questionType: FormQuestionTypesEnum): SurveyQuestionDefinition => ({
  id: 'question-id', source: {}, sourceId: 'question-source', uniqueIdPerForm: 'question-ref',
  questionType, isActive: true, isRequired: false, settings: null,
  options: [
    { id: 'option-a', source: {}, sourceId: 'option-source-a', uniqueIdPerForm: 'option-ref-a', settings: null },
    { id: 'option-b', source: {}, sourceId: 'option-source-b', uniqueIdPerForm: 'option-ref-b', settings: null },
  ],
});

const answer = (value: QuestionAnswerState['value'], selectedOptionIds: string[] = []): QuestionAnswerState => ({
  questionId: 'question-id', value, selectedOptionIds, isDirty: false, updatedAtRevision: 0,
});

describe('projectCanonicalAnswerToLegacy', () => {
  it('projects selected options to the legacy comma-separated source IDs and option flags', () => {
    const result = projectCanonicalAnswerToLegacy(
      question(FormQuestionTypesEnum.MultiSelect),
      answer(null, ['option-b', 'option-a']),
    );
    expect(result.answer).toBe('option-source-b,option-source-a');
    expect(result.options.map((item) => [item.selected, item.orderAnswer])).toEqual([[true, 1], [true, 0]]);
  });

  it('projects scalar values and shared descriptions', () => {
    const result = projectCanonicalAnswerToLegacy(
      question(FormQuestionTypesEnum.ShortText),
      answer({ value: 'hello', descriptionAnswer: 'details' }),
    );
    expect(result.answer).toBe('hello');
    expect(result.descriptionAnswer).toBe('details');
    expect(result.hasAnswer).toBe(true);
  });

  it('projects HasPriority description objects to the legacy ordered answer string', () => {
    const result = projectCanonicalAnswerToLegacy(
      question(FormQuestionTypesEnum.HasPriority),
      answer({ answer: 'option-source-b,option-source-a', descriptionAnswer: 'rank notes' }, ['option-b', 'option-a']),
    );
    expect(result.answer).toBe('option-source-b,option-source-a');
    expect(result.descriptionAnswer).toBe('rank notes');
  });

  it('projects option-specific descriptions without changing selection', () => {
    const result = projectCanonicalAnswerToLegacy(
      question(FormQuestionTypesEnum.MultiSelect),
      answer({ descriptionAnswer: '', optionDescriptions: { 'option-b': 'other text' } }, ['option-b']),
    );
    expect(result.options[1]).toMatchObject({ selected: true, answerDescription: 'other text' });
  });

  it('projects matrix cell values as option descriptions', () => {
    const result = projectCanonicalAnswerToLegacy(
      question(FormQuestionTypesEnum.Matrix_MultiShortText),
      answer({ 'option-a': 'row answer' }, ['option-a']),
    );
    expect(result.options[0]).toMatchObject({ selected: true, answerDescription: 'row answer' });
  });

  it('keeps dynamic and SKU payloads intact', () => {
    const dynamic = { identificationCode: 12, answerTitle: 'record' };
    expect(projectCanonicalAnswerToLegacy(question(FormQuestionTypesEnum.DynamicAnswer), answer(dynamic)).answer)
      .toEqual(dynamic);
    const sku = [{ identificationCode: 12, quantity: 2, total: 4 }];
    expect(projectCanonicalAnswerToLegacy(question(FormQuestionTypesEnum.SkuCount_Dynamic), answer(sku)).answer)
      .toEqual(sku);
  });
});
