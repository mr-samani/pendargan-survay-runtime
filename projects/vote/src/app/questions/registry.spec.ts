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

  it('registers RetailAudit as a concrete lazy renderer', async () => {
    const renderer = await REGISTRED_QUESTIONS.load(FormQuestionTypesEnum.RetailAudit);
    expect(renderer).toBeDefined();
  });

  it('registers Matrix_Dynamic and all of its legacy cell question types', async () => {
    const types = [
      FormQuestionTypesEnum.Matrix_Dynamic,
      FormQuestionTypesEnum.Matrix_Radio,
      FormQuestionTypesEnum.Matrix_Checkbox,
      FormQuestionTypesEnum.Matrix_MultiNumeric,
      FormQuestionTypesEnum.Matrix_MultiShortText,
    ];
    const renderers = await REGISTRED_QUESTIONS.loadMany(types);
    expect(renderers.size).toBe(types.length);
    for (const type of types) expect(renderers.get(type)).toBeDefined();
  });

  it('does not advertise platform-bound renderers as implemented', async () => {
    const unsupported = [
      FormQuestionTypesEnum.FileUpload,
      FormQuestionTypesEnum.Payment,
      FormQuestionTypesEnum.Captcha,
      FormQuestionTypesEnum.Location,
      FormQuestionTypesEnum.VoiceRecord,
      FormQuestionTypesEnum.RecordsOtherForms,
    ];
    for (const type of unsupported) {
      await expect(REGISTRED_QUESTIONS.load(type)).rejects.toThrow('not implemented');
    }
  });
});
