import { FormQuestionTypesEnum } from '@service-proxies/models';
import { createQuestionRendererRegistry } from './definitions';

export const REGISTRED_QUESTIONS = createQuestionRendererRegistry({
  [FormQuestionTypesEnum.CustomMaskShortText]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.ShortText]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.LongText]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.Numeric]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.Date]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.Time]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.Email]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.Phone]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.Mobile]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.NationalCode]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),
  [FormQuestionTypesEnum.PostalCode]: () =>
    import('./ScalarAnswer/ScalarAnswer').then((module) => module.ScalarAnswer),

  [FormQuestionTypesEnum.Dropdown]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.Point]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.Point_NumericScale]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.NPS]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.Rating]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.Emoji]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.HasPriority]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.Matrix]: () =>
    import('./LegacyInput/LegacyInput').then((module) => module.LegacyInput),
  [FormQuestionTypesEnum.HtmlFrame]: () =>
    import('./HtmlFrame/HtmlFrame').then((module) => module.HtmlFrame),

  [FormQuestionTypesEnum.UniqueSelectWithImageOptions]: () =>
    import('./UniqueSelect/UniqueSelect').then((module) => module.UniqueSelect),
  [FormQuestionTypesEnum.MultiSelectWithImageOptions]: () =>
    import('./MultiSelect/MultiSelect').then((module) => module.MultiSelect),
  [FormQuestionTypesEnum.UniqueSelect]: () =>
    import('./UniqueSelect/UniqueSelect').then((module) => module.UniqueSelect),

  [FormQuestionTypesEnum.MultiSelect]: () =>
    import('./MultiSelect/MultiSelect').then((module) => module.MultiSelect),

  [FormQuestionTypesEnum.DynamicAnswer]: () =>
    import('./DynamicAnswer/DynamicAnswer').then((module) => module.DynamicAnswer),

  [FormQuestionTypesEnum.SkuCount_Dynamic]: () =>
    import('./SkuCountDynamic/SkuCountDynamic').then((module) => module.SkuCountDynamic),
});


/** Question types currently backed by a concrete runtime renderer. */
export const SUPPORTED_QUESTION_RENDERER_TYPES = Object.freeze([
  FormQuestionTypesEnum.ShortText,
  FormQuestionTypesEnum.LongText,
  FormQuestionTypesEnum.Numeric,
  FormQuestionTypesEnum.Date,
  FormQuestionTypesEnum.Time,
  FormQuestionTypesEnum.Email,
  FormQuestionTypesEnum.Phone,
  FormQuestionTypesEnum.Mobile,
  FormQuestionTypesEnum.NationalCode,
  FormQuestionTypesEnum.PostalCode,
  FormQuestionTypesEnum.CustomMaskShortText,
  FormQuestionTypesEnum.Dropdown,
  FormQuestionTypesEnum.UniqueSelect,
  FormQuestionTypesEnum.MultiSelect,
  FormQuestionTypesEnum.UniqueSelectWithImageOptions,
  FormQuestionTypesEnum.MultiSelectWithImageOptions,
  FormQuestionTypesEnum.Point,
  FormQuestionTypesEnum.Point_NumericScale,
  FormQuestionTypesEnum.NPS,
  FormQuestionTypesEnum.Rating,
  FormQuestionTypesEnum.Emoji,
  FormQuestionTypesEnum.HasPriority,
  FormQuestionTypesEnum.Matrix,
  FormQuestionTypesEnum.DynamicAnswer,
  FormQuestionTypesEnum.SkuCount_Dynamic,
  FormQuestionTypesEnum.HtmlFrame,
] as const);
