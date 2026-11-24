import { FormQuestionTypesEnum } from '@service-proxies/models';
import { createQuestionRendererRegistry } from './definitions';

export const REGISTRED_QUESTIONS = createQuestionRendererRegistry({
  [FormQuestionTypesEnum.HtmlFrame]: () =>
    import('./HtmlFrame/HtmlFrame').then((module) => module.HtmlFrame),

  [FormQuestionTypesEnum.UniqueSelect]: () =>
    import('./UniqueSelect/UniqueSelect').then((module) => module.UniqueSelect),

  [FormQuestionTypesEnum.MultiSelect]: () =>
    import('./MultiSelect/MultiSelect').then((module) => module.MultiSelect),
});
