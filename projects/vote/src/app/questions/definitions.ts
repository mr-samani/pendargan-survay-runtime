import type { Type } from '@angular/core';
import {
  FormQuestionTypesEnum,
  type GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';

export type QuestionRenderer = Type<unknown>;
export type QuestionRendererLoader = () => Promise<QuestionRenderer>;

export interface QuestionRendererRegistry {
  load(type: FormQuestionTypesEnum | undefined): Promise<QuestionRenderer>;
  loadMany(
    types: readonly (FormQuestionTypesEnum | undefined)[],
  ): Promise<ReadonlyMap<FormQuestionTypesEnum, QuestionRenderer>>;
}

/**
 * Creates a registry with one in-flight/resolved Promise per question type.
 * Failed loads are evicted so a later attempt can retry.
 */
export function createQuestionRendererRegistry(
  loaders: Partial<Record<FormQuestionTypesEnum, QuestionRendererLoader>>,
): QuestionRendererRegistry {
  const cache = new Map<FormQuestionTypesEnum, Promise<QuestionRenderer>>();

  const load = (type: FormQuestionTypesEnum | undefined): Promise<QuestionRenderer> => {
    if (type == null) {
      return Promise.reject(new Error('Question type is required.'));
    }

    const loader = loaders[type];
    if (!loader) {
      const name = FormQuestionTypesEnum[type] ?? String(type);
      return Promise.reject(new Error(`"${name}" question type is not implemented.`));
    }

    const cached = cache.get(type);
    if (cached) return cached;

    const pending = loader().catch((error: unknown) => {
      cache.delete(type);
      throw error;
    });
    cache.set(type, pending);
    return pending;
  };

  const loadMany = async (
    types: readonly (FormQuestionTypesEnum | undefined)[],
  ): Promise<ReadonlyMap<FormQuestionTypesEnum, QuestionRenderer>> => {
    const uniqueTypes = [...new Set(types.filter(
      (type): type is FormQuestionTypesEnum => type != null,
    ))];

    const entries = await Promise.all(
      uniqueTypes.map(async (type) => [type, await load(type)] as const),
    );
    return new Map(entries);
  };

  return { load, loadMany };
}

const registry = createQuestionRendererRegistry({
  [FormQuestionTypesEnum.HtmlFrame]: () =>
    import('./HtmlFrame/HtmlFrame').then((module) => module.HtmlFrame),

  [FormQuestionTypesEnum.UniqueSelect]: () =>
    import('./UniqueSelect/UniqueSelect').then((module) => module.UniqueSelect),

  [FormQuestionTypesEnum.MultiSelect]: () =>
    import('./MultiSelect/MultiSelect').then((module) => module.MultiSelect),
});

export function loadQuestionRenderer(
  type: FormQuestionTypesEnum | undefined,
): Promise<QuestionRenderer> {
  return registry.load(type);
}

export function loadQuestionRenderers(
  types: readonly (FormQuestionTypesEnum | undefined)[],
): Promise<ReadonlyMap<FormQuestionTypesEnum, QuestionRenderer>> {
  return registry.loadMany(types);
}

/** Backward-compatible adapter for existing QuestionModel callers. */
export async function DeclareQuestion(
  question: GetFormQuestionQuestionOptionDto | null | undefined,
): Promise<QuestionRenderer> {
  return loadQuestionRenderer(question?.questionType);
}
