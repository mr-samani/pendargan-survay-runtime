import type { Type } from '@angular/core';
import {
  FormQuestionTypesEnum,
  type GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';
interface QuestionDefinition {
  [key: number]: () => Promise<Type<any>>;
}
const QUESTIONS: QuestionDefinition = {
  [FormQuestionTypesEnum.HtmlFrame]: () => import('./HtmlFrame/HtmlFrame').then((c) => c.HtmlFrame),

  [FormQuestionTypesEnum.UniqueSelect]: () =>
    import('./UniqueSelect/UniqueSelect').then((c) => c.UniqueSelect),

  [FormQuestionTypesEnum.MultiSelect]: () =>
    import('./MultiSelect/MultiSelect').then((c) => c.MultiSelect),
};

export async function DeclareQuestion(q: GetFormQuestionQuestionOptionDto): Promise<Type<any>> {
  if (!q || !q.questionType) {
    throw Error(`"${FormQuestionTypesEnum[q.questionType!]}" Question Not Valid!`);
  }
  const c = QUESTIONS[q.questionType];
  if (!c) {
    throw Error(`"${FormQuestionTypesEnum[q.questionType!]}" Question Not Implemented!`);
  }
  return await c();
}
