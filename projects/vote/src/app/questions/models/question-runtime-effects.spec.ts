import { describe, expect, it } from 'vitest';
import type { LegacyGlobalVariableEffectBatch } from '../../runtime/session/legacy-global-variable-dispatcher';
import {
  applyQuestionRuntimeEffects,
  getQuestionRuntimeEffect,
  type QuestionRuntimeEffectsByInstance,
} from './question-runtime-effects';

function batch(
  paymentAmountOverrides: readonly { questionId: string; amount: number }[] = [],
  secondaryFilterUpdates: readonly { questionId: string; value: string }[] = [],
): LegacyGlobalVariableEffectBatch {
  return {
    changedVariableIds: [],
    answerCommands: [],
    paymentAmountOverrides,
    secondaryFilterUpdates,
    questionsToRecalculate: [],
    sourceEffects: [],
  };
}

describe('question runtime effects', () => {
  it('applies Payment and secondary-filter values as one immutable instance snapshot', () => {
    const previous: QuestionRuntimeEffectsByInstance = Object.freeze({});
    const result = applyQuestionRuntimeEffects(
      previous,
      'root',
      batch(
        [{ questionId: 'payment-fid', amount: 125 }],
        [{ questionId: 'sku-fid', value: 'category=food' }],
      ),
    );

    expect(result.changedQuestionIds).toEqual(['payment-fid', 'sku-fid']);
    expect(result.paymentAmountQuestionIds).toEqual(['payment-fid']);
    expect(result.secondaryFilterQuestionIds).toEqual(['sku-fid']);
    expect(getQuestionRuntimeEffect(result.state, 'root', 'payment-fid')).toEqual({
      paymentAmount: 125,
      secondaryFieldValueFilter: undefined,
      revision: 1,
    });
    expect(getQuestionRuntimeEffect(result.state, 'root', 'sku-fid')).toEqual({
      paymentAmount: undefined,
      secondaryFieldValueFilter: 'category=food',
      revision: 1,
    });
    expect(previous).toEqual({});
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(Object.isFrozen(result.state['root'])).toBe(true);
  });

  it('isolates effects across SectionLoop answer instances', () => {
    const first = applyQuestionRuntimeEffects(
      Object.freeze({}), 'loop:section-a:0',
      batch([{ questionId: 'payment-fid', amount: 100 }]),
    );
    const second = applyQuestionRuntimeEffects(
      first.state, 'loop:section-a:1',
      batch([{ questionId: 'payment-fid', amount: 250 }]),
    );

    expect(getQuestionRuntimeEffect(second.state, 'loop:section-a:0', 'payment-fid')?.paymentAmount)
      .toBe(100);
    expect(getQuestionRuntimeEffect(second.state, 'loop:section-a:1', 'payment-fid')?.paymentAmount)
      .toBe(250);
  });

  it('does not emit a UI change when the effective value is unchanged', () => {
    const first = applyQuestionRuntimeEffects(
      Object.freeze({}), 'root',
      batch([], [{ questionId: 'sku-fid', value: 'category=food' }]),
    );
    const second = applyQuestionRuntimeEffects(
      first.state, 'root',
      batch([], [{ questionId: 'sku-fid', value: 'category=food' }]),
    );

    expect(second.state).toBe(first.state);
    expect(second.changedQuestionIds).toEqual([]);
    expect(second.secondaryFilterQuestionIds).toEqual([]);
  });

  it('retains unrelated overrides when only one effect kind changes', () => {
    const first = applyQuestionRuntimeEffects(
      Object.freeze({}), 'root',
      batch([{ questionId: 'q', amount: 99 }], [{ questionId: 'q', value: 'region=north' }]),
    );
    const second = applyQuestionRuntimeEffects(
      first.state, 'root',
      batch([{ questionId: 'q', amount: 120 }]),
    );

    expect(getQuestionRuntimeEffect(second.state, 'root', 'q')).toEqual({
      paymentAmount: 120,
      secondaryFieldValueFilter: 'region=north',
      revision: 2,
    });
  });

  it('uses the last value in a merged effect batch and increments one revision per changed question', () => {
    const result = applyQuestionRuntimeEffects(
      Object.freeze({}), 'root',
      batch(
        [{ questionId: 'q', amount: 10 }, { questionId: 'q', amount: 20 }],
        [{ questionId: 'q', value: 'a=1' }, { questionId: 'q', value: 'a=2' }],
      ),
    );

    expect(getQuestionRuntimeEffect(result.state, 'root', 'q')).toEqual({
      paymentAmount: 20,
      secondaryFieldValueFilter: 'a=2',
      revision: 2,
    });
  });
});
