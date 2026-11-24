import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import type { QuestionAnswerState } from '../state/answer-state.types';
import {
  QuestionAnswerSerializationError,
  serializeQuestionAnswer,
} from './question-answer-serializer';

function question(
  type: FormQuestionTypesEnum,
  source: Record<string, unknown> = {},
): SurveyQuestionDefinition {
  return {
    id: 'q',
    source: { uniqueId: 'q-backend', ...source },
    sourceId: 'q-backend',
    uniqueIdPerForm: 'q-form',
    questionType: type,
    formSectionUniqueId: 'section',
    isActive: true,
    isRequired: false,
    settings: null,
    options: [
      { id: 'a', sourceId: 'a-backend', uniqueIdPerForm: 'a-form', title: 'Alpha',
        source: { uniqueId: 'a-backend', title: 'Alpha', hasDescriptiveAnswer: true }, settings: null },
      { id: 'b', sourceId: 'b-backend', uniqueIdPerForm: 'b-form', title: 'Beta',
        source: { uniqueId: 'b-backend', title: 'Beta' }, settings: null },
    ],
  };
}
function answer(value: any, selectedOptionIds: string[] = []): QuestionAnswerState {
  return { questionId: 'q', value, selectedOptionIds, isDirty: true, updatedAtRevision: 1 };
}

describe('serializeQuestionAnswer', () => {
  it('serializes selected options one row per option and applies AllOptions description', () => {
    const result = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.UniqueSelect, { hasDescription: true, descriptionType: 1 }),
      answer({ descriptionAnswer: 'reason' }, ['a', 'b']),
    );
    expect(result.map((item) => item.questionOptionUniqueId)).toEqual(['a-backend', 'b-backend']);
    expect(result.map((item) => item.answerDescription)).toEqual(['reason', 'reason']);
    expect(result.map((item) => item.formQuestionUniqueId)).toEqual(['q-backend', 'q-backend']);
  });

  it('uses per-option descriptions for MultiSelect', () => {
    const result = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.MultiSelect, { hasDescription: true, descriptionType: 1 }),
      answer({ optionDescriptions: { a: 'alpha reason' } }, ['a', 'b']),
    );
    expect(result.map((item) => item.answerDescription)).toEqual(['alpha reason', '']);
  });

  it('matches legacy option-description policies for SelectedOption and LastOption', () => {
    const selected = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.UniqueSelect, { hasDescription: true, descriptionType: 3 }),
      answer({ descriptionAnswer: 'only alpha' }, ['a', 'b']),
    );
    expect(selected.map((item) => item.answerDescription)).toEqual(['only alpha', '']);

    const last = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.UniqueSelect, { hasDescription: true, descriptionType: 2 }),
      answer({ descriptionAnswer: 'last option note' }, ['a', 'b']),
    );
    expect(last.map((item) => item.answerDescription)).toEqual(['', 'last option note']);
  });

  it('omits hidden options but does not invent an inactive-option filter absent from the legacy converter', () => {
    const q = question(FormQuestionTypesEnum.UniqueSelect);
    (q.options[0].source as Record<string, unknown>)['dontShow'] = true;
    (q.options[1].source as Record<string, unknown>)['isActive'] = false;
    const result = serializeQuestionAnswer(q, answer(null, ['a', 'b']));
    expect(result.map((item) => item.questionOptionUniqueId)).toEqual(['b-backend']);
  });

  it('does not emit answers for hidden questions, except Group', () => {
    expect(serializeQuestionAnswer(
      question(FormQuestionTypesEnum.Numeric), answer(5), { isVisible: false },
    )).toEqual([]);
  });

  it('preserves HasPriority order from the comma-separated legacy answer', () => {
    const result = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.HasPriority),
      answer('b,a'),
    );
    expect(result.map((item) => item.questionOptionUniqueId)).toEqual(['b-backend', 'a-backend']);
    expect(result.map((item) => item.orderAnswer)).toEqual([1, 2]);
  });

  it('serializes static and dynamic SKU quantities using their legacy fields', () => {
    const staticResult = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.SkuCount),
      answer([{ questionOptionUniqueId: 'a-backend', answerTitle: 'Alpha', total: 4 }]),
      { dynamicDataRecordId: 17 },
    );
    expect(staticResult[0]).toMatchObject({
      questionOptionUniqueId: 'a-backend', answerTitle: 'Alpha',
      answerDescription: '4', dynamicDataRecordId: 17,
    });

    const dynamicResult = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.SkuCount_Dynamic),
      answer([{ identificationCode: 29, answerTitle: 'Dynamic item', total: 2 }]),
    );
    expect(dynamicResult[0]).toMatchObject({
      questionOptionUniqueId: '', answerTitle: 'Dynamic item',
      answerDescription: '2', dynamicDataRecordId: 29,
    });
  });

  it('serializes scalar, Point/NPS no-comment, and DynamicAnswer values', () => {
    const scalar = serializeQuestionAnswer(question(FormQuestionTypesEnum.Numeric), answer(12));
    expect(scalar[0].answerDescription).toBe('12');

    const nps = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.NPS, { }),
      answer(8),
    );
    expect(nps[0].answerDescription).toBe('8');

    const dynamic = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.DynamicAnswer),
      answer({ identificationCode: 31, answerTitle: 'Record title' }),
    );
    expect(dynamic[0]).toMatchObject({
      dynamicDataRecordId: 31, answerTitle: 'Record title', answerDescription: '',
    });
  });

  it('preserves Point/NPS no-comment labels and evaluated verification GUIDs', () => {
    const point = question(FormQuestionTypesEnum.Point, { hasVerification: true });
    const verified = serializeQuestionAnswer(point, answer({ value: 6, validationGuid: 'verified-guid' }));
    expect(verified[0]).toMatchObject({ answerDescription: '6', validationGuid: 'verified-guid' });

    const npsQuestion = question(FormQuestionTypesEnum.NPS);
    (npsQuestion as any).settings = {
      showNoCommentOption: true, noComment: true, noCommentOptionText: 'No comment',
    };
    const nps = serializeQuestionAnswer(npsQuestion, answer(9));
    expect(nps[0]).toMatchObject({ answerTitle: 'No comment', answerDescription: '9' });
  });

  it('emits an empty SKU list as no answer rows, while empty file questions retain their legacy row', () => {
    expect(serializeQuestionAnswer(question(FormQuestionTypesEnum.SkuCount), answer(null))).toEqual([]);
    const file = serializeQuestionAnswer(question(FormQuestionTypesEnum.FileUpload), answer(null));
    expect(file).toHaveLength(1);
    expect(file[0].files).toEqual([]);
  });

  it('serializes file identifiers in stable order', () => {
    const result = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.FileUpload),
      answer([{ fileUniqueId: 'file-a' }, { fileUniqueId: 'file-b' }]),
    );
    expect(result[0].files?.map((item) => [item.fileUniqueId, item.order])).toEqual([
      ['file-a', 0], ['file-b', 1],
    ]);
  });

  it('serializes Captcha and Payment validation fields', () => {
    const captcha = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.Captcha),
      answer({ validationKey: 'captcha-key', answer: 'captcha-guid' }),
    );
    expect(captcha[0]).toMatchObject({
      answerDescription: 'captcha-key', validationGuid: 'captcha-guid',
    });

    const paymentQuestion = question(FormQuestionTypesEnum.Payment, {});
    (paymentQuestion as any).settings = { amount: 125000 };
    const payment = serializeQuestionAnswer(
      paymentQuestion,
      answer({ validationKey: 'payment-key', answer: 'payment-guid' }),
    );
    expect(payment[0]).toMatchObject({
      answerTitle: '125000', answerDescription: 'payment-key', validationGuid: 'payment-guid',
    });
  });

  it('preserves Group answers even when the question is hidden', () => {
    const result = serializeQuestionAnswer(
      question(FormQuestionTypesEnum.Group),
      answer('group-answer'),
      { isVisible: false },
    );
    expect(result[0]).toMatchObject({ answerDescription: 'group-answer', orderAnswer: 0 });
  });

  it('omits content/container question types as the legacy converter does', () => {
    expect(serializeQuestionAnswer(question(FormQuestionTypesEnum.HtmlFrame), answer(null))).toEqual([]);
    expect(serializeQuestionAnswer(question(FormQuestionTypesEnum.Matrix), answer(null))).toEqual([]);
    expect(serializeQuestionAnswer(question(FormQuestionTypesEnum.RetailAudit), answer(null))).toEqual([]);
  });

  it('rejects string dynamic IDs rather than silently corrupting the generated numeric DTO contract', () => {
    expect(() => serializeQuestionAnswer(
      question(FormQuestionTypesEnum.DynamicAnswer),
      answer({ identificationCode: 'record-guid', answerTitle: 'Record' }),
    )).toThrowError(QuestionAnswerSerializationError);
  });
});
