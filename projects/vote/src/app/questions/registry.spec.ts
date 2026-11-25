import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { REGISTRED_QUESTIONS, SUPPORTED_QUESTION_RENDERER_TYPES } from './registry';

describe('registered question renderers', () => {
  it('loads every explicitly supported renderer type', async () => {
    const renderers = await REGISTRED_QUESTIONS.loadMany(SUPPORTED_QUESTION_RENDERER_TYPES);
    expect(renderers.size).toBe(SUPPORTED_QUESTION_RENDERER_TYPES.length);
    for (const type of SUPPORTED_QUESTION_RENDERER_TYPES) {
      expect(renderers.get(type), FormQuestionTypesEnum[type]).toBeDefined();
    }
  });

  it('does not advertise platform-bound renderers as implemented', async () => {
    const unsupported = [
      FormQuestionTypesEnum.FileUpload,
      FormQuestionTypesEnum.Payment,
      FormQuestionTypesEnum.Captcha,
      FormQuestionTypesEnum.Location,
      FormQuestionTypesEnum.VoiceRecord,
      FormQuestionTypesEnum.RetailAudit,
      FormQuestionTypesEnum.RecordsOtherForms,
      FormQuestionTypesEnum.Matrix_Dynamic,
    ];
    for (const type of unsupported) {
      await expect(REGISTRED_QUESTIONS.load(type)).rejects.toThrow('not implemented');
    }
  });
});
