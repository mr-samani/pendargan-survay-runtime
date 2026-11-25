import {
  FormQuestionTypesEnum,
  GetFormQuestionAnswerDto,
  VoterAnswerDetailDto,
  VoterFileDetailDto,
  VoterAndFormQuestionFilesLimitedDto,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import { restoreQuestionAnswer } from './question-answer-restorer';

function question(type: FormQuestionTypesEnum): SurveyQuestionDefinition {
  return {
    id: 'q',
    source: { uniqueId: 'q-db', dynamicDataUniqueId: 'dynamic-data', hasInitialValue: true, isEditableInitialValue: true },
    sourceId: 'q-db',
    uniqueIdPerForm: 'q-fid',
    questionType: type,
    isActive: true,
    isRequired: false,
    settings: null,
    options: [
      { id: 'a', sourceId: 'a-db', uniqueIdPerForm: 'a-fid', title: 'Alpha',
        source: { uniqueId: 'a-db', title: 'Alpha', hasDescriptiveAnswer: true }, settings: null },
      { id: 'b', sourceId: 'b-db', uniqueIdPerForm: 'b-fid', title: 'Beta',
        source: { uniqueId: 'b-db', title: 'Beta' }, settings: null },
    ],
  };
}
function saved(rows: Partial<VoterAnswerDetailDto>[], extra: Partial<GetFormQuestionAnswerDto> = {}) {
  return new GetFormQuestionAnswerDto({
    uniqueId: 'q-db',
    voterAnswerDetailDto: rows.map((row) => new VoterAnswerDetailDto(row)),
    ...extra,
  });
}

describe('restoreQuestionAnswer', () => {
  it('restores choice IDs and MultiSelect option descriptions', () => {
    const result = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.MultiSelect),
      saved([
        { questionOptionUniqueId: 'b-db', answerDescription: 'Beta note' },
        { questionOptionUniqueId: 'a-db', answerDescription: 'Alpha note' },
      ], { hasDescription: true }),
    );
    expect(result.answer.selectedOptionIds).toEqual(['b', 'a']);
    expect(result.answer.value).toMatchObject({
      descriptionAnswer: 'Beta note',
      optionDescriptions: { b: 'Beta note', a: 'Alpha note' },
    });
  });

  it('restores HasPriority order and scalar values', () => {
    const priority = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.HasPriority),
      saved([
        { questionOptionUniqueId: 'b-db', orderAnswer: 1 },
        { questionOptionUniqueId: 'a-db', orderAnswer: 2 },
      ]),
    );
    expect(priority.answer.value).toBe('b,a');
    expect(priority.answer.selectedOptionIds).toEqual(['b', 'a']);

    const scalar = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.Numeric),
      saved([{ answerDescription: '125' }]),
    );
    expect(scalar.answer.value).toBe('125');
    expect(scalar.shouldClearEditableInitialValue).toBe(true);
    expect(scalar.answer.shouldClearEditableInitialValue).toBe(true);
  });

  it('restores DynamicAnswer identity/title and SKU quantities', () => {
    const dynamic = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.DynamicAnswer),
      saved([{ dynamicDataRecordId: 15, answerTitle: 'Record', jsonValuesDictionary: { code: 'A1' } }]),
    );
    expect(dynamic.answer.value).toMatchObject({
      identificationCode: 15, answerTitle: 'Record', jsonValuesDictionary: { code: 'A1' },
    });

    const sku = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.SkuCount),
      saved([{ dynamicDataRecordId: 7, questionOptionUniqueId: 'a-db', answerTitle: 'Alpha', answerDescription: '3' }]),
    );
    expect(sku.answer.value).toMatchObject([{
      identificationCode: 7, questionOptionUniqueId: 'a-db', total: 3, quantity: 1,
    }]);
  });

  it('restores file details and Captcha/Payment validation values', () => {
    const file = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.FileUpload),
      saved([{
        files: [new VoterFileDetailDto({
          file: new VoterAndFormQuestionFilesLimitedDto({
            id: 8, uniqueId: 'file-guid', fileName: 'photo.png',
            size: 1024, extension: 'png', contentType: 'image/png', addressUrl: '/files/photo.png',
          }),
        })],
      }]),
    );
    expect(file.answer.value).toMatchObject([{
      fileId: 8, fileUniqueId: 'file-guid', name: 'photo.png', ext: 'png', progress: 100,
    }]);

    const captcha = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.Captcha),
      saved([{ answerDescription: 'captcha-key', validationGuid: 'captcha-guid' }]),
    );
    expect(captcha.answer.value).toMatchObject({
      validationKey: 'captcha-key', answer: 'captcha-guid',
    });
  });

  it('warns for missing option IDs and defers RetailAudit to its section-level adapter', () => {
    const choice = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.UniqueSelect),
      saved([{ questionOptionUniqueId: 'deleted-option' }]),
    );
    expect(choice.diagnostics[0].code).toBe('RESTORE_OPTION_NOT_IN_DEFINITION');

    const retail = restoreQuestionAnswer(
      question(FormQuestionTypesEnum.RetailAudit),
      saved([{ dynamicDataRecordId: 12 }]),
    );
    expect(retail.diagnostics[0].code).toBe('RESTORE_RETAIL_AUDIT_REQUIRES_SECTION_CONTEXT');
  });

  it('restores Matrix cell values from each option answerDescription without selecting empty cells', () => {
    for (const type of [
      FormQuestionTypesEnum.Matrix_MultiNumeric,
      FormQuestionTypesEnum.Matrix_MultiShortText,
    ]) {
      const result = restoreQuestionAnswer(
        question(type),
        saved([
          { questionOptionUniqueId: 'a-db', answerDescription: type === FormQuestionTypesEnum.Matrix_MultiNumeric ? '12.5' : 'comment' },
          { questionOptionUniqueId: 'b-db', answerDescription: '' },
        ]),
      );
      expect(result.answer.selectedOptionIds).toEqual(['a']);
      expect(result.answer.value).toEqual({
        a: type === FormQuestionTypesEnum.Matrix_MultiNumeric ? '12.5' : 'comment',
      });
    }
  });
});
