import type { Type } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { createQuestionRendererRegistry } from './definitions';

describe('QuestionRendererRegistry', () => {
  it('shares the same in-flight Promise and caches a loaded renderer', async () => {
    class TestRenderer {}
    const loader = vi.fn(async () => TestRenderer as unknown as Type<unknown>);
    const registry = createQuestionRendererRegistry({
      [FormQuestionTypesEnum.UniqueSelect]: loader,
    });

    const first = registry.load(FormQuestionTypesEnum.UniqueSelect);
    const second = registry.load(FormQuestionTypesEnum.UniqueSelect);

    expect(first).toBe(second);
    expect(await first).toBe(TestRenderer);
    expect(await registry.load(FormQuestionTypesEnum.UniqueSelect)).toBe(TestRenderer);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('loads unique required types concurrently and returns a type map', async () => {
    class FirstRenderer {}
    class SecondRenderer {}
    const firstLoader = vi.fn(async () => FirstRenderer as unknown as Type<unknown>);
    const secondLoader = vi.fn(async () => SecondRenderer as unknown as Type<unknown>);
    const registry = createQuestionRendererRegistry({
      [FormQuestionTypesEnum.UniqueSelect]: firstLoader,
      [FormQuestionTypesEnum.MultiSelect]: secondLoader,
    });

    const result = await registry.loadMany([
      FormQuestionTypesEnum.UniqueSelect,
      FormQuestionTypesEnum.MultiSelect,
      FormQuestionTypesEnum.UniqueSelect,
      undefined,
    ]);

    expect(result.size).toBe(2);
    expect(result.get(FormQuestionTypesEnum.UniqueSelect)).toBe(FirstRenderer);
    expect(result.get(FormQuestionTypesEnum.MultiSelect)).toBe(SecondRenderer);
    expect(firstLoader).toHaveBeenCalledTimes(1);
    expect(secondLoader).toHaveBeenCalledTimes(1);
  });

  it('rejects missing and unsupported question types', async () => {
    const registry = createQuestionRendererRegistry({});

    await expect(registry.load(undefined)).rejects.toThrow('Question type is required.');
    await expect(registry.load(FormQuestionTypesEnum.Payment)).rejects.toThrow(
      '"Payment" question type is not implemented.',
    );
  });

  it('evicts failed loads so the next attempt can retry', async () => {
    class TestRenderer {}
    const loader = vi
      .fn<() => Promise<Type<unknown>>>()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce(TestRenderer as unknown as Type<unknown>);
    const registry = createQuestionRendererRegistry({
      [FormQuestionTypesEnum.UniqueSelect]: loader,
    });

    await expect(registry.load(FormQuestionTypesEnum.UniqueSelect)).rejects.toThrow(
      'chunk unavailable',
    );
    await expect(registry.load(FormQuestionTypesEnum.UniqueSelect)).resolves.toBe(TestRenderer);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
