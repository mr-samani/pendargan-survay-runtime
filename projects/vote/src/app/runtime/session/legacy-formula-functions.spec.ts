import { describe, expect, it, vi } from 'vitest';
import {
  createLegacyFormulaFunctions,
  legacyLooseEqual,
  legacyLooseNotEqual,
  LegacyFormulaFunctionError,
  normalizeLegacyMathJsExpression,
} from './legacy-formula-functions';

describe('legacy formula function compatibility', () => {
  it('caches random values by key for one evaluator instance and includes both endpoints', () => {
    const randomSource = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1);
    const functions = createLegacyFormulaFunctions(randomSource);

    expect(functions.random(10, 'first')).toBe(0);
    expect(functions.random(100, 'first')).toBe(0);
    expect(functions.random(10, 'second')).toBe(5);
    expect(functions.random(10, 'third')).toBe(10);
    expect(randomSource).toHaveBeenCalledTimes(3);
  });

  it('validates random key, numeric maximum and non-negative range', () => {
    const functions = createLegacyFormulaFunctions(() => 0.5);
    expect(() => functions.random(10)).toThrowError(
      expect.objectContaining({ code: 'RANDOM_KEY_REQUIRED', name: 'NoKeyDefined' }),
    );
    expect(() => functions.random('not-a-number', 'key')).toThrowError(
      expect.objectContaining({ code: 'RANDOM_MAX_NOT_NUMERIC', name: 'NoneNumericParameter' }),
    );
    expect(() => functions.random(-1, 'key')).toThrowError(
      expect.objectContaining({ code: 'RANDOM_MAX_NEGATIVE', name: 'NegativeParameter' }),
    );
    expect(functions.random('10', 'numeric-string')).toBe(5);
  });

  it('implements the legacy string functions and rejects non-string arguments', () => {
    const functions = createLegacyFormulaFunctions();
    expect(functions.endsWith('pendargan', 'gan')).toBe(true);
    expect(functions.startsWith('pendargan', 'pen')).toBe(true);
    expect(functions.contains('pendargan', 'dar')).toBe(true);
    expect(() => functions.contains('text', 1)).toThrowError(
      expect.objectContaining({
        code: 'INVALID_STRING_ARGUMENTS',
        functionName: 'stringFunctions',
        type: 'ExpressionFuncError',
      }),
    );
  });

  it('calculates the weighted average above the neutral threshold and rounds to two decimals', () => {
    const functions = createLegacyFormulaFunctions();
    expect(functions.avgWeakData(1, 2, 1, 6, 2)).toBe(4.67);
    expect(functions.avgWeakData(2, 2, 10, 6, 2)).toBe(6);
    expect(functions.avgWeakData(10, 2, 1, 6, 2)).toBe(0);
    expect(functions.avgWeakData(1)).toBe(0);
  });

  it('rejects an odd value/weight argument count for avgWeakData', () => {
    const functions = createLegacyFormulaFunctions();
    expect(() => functions.avgWeakData(1, 2, 1, 6)).toThrowError(
      expect.objectContaining({ code: 'AVG_WEAK_DATA_INVALID_PARAMETER_COUNT' }),
    );
  });

  it('normalizes legacy mathjs operators without rewriting inequality operators', () => {
    expect(normalizeLegacyMathJsExpression(
      'math.random(10, key) && !isReady || count != 2',
    )).toBe('random(10, key)  and   not isReady  or  count != 2');
  });

  it('preserves JavaScript loose equality semantics', () => {
    expect(legacyLooseEqual(1, '1')).toBe(true);
    expect(legacyLooseEqual(false, 0)).toBe(true);
    expect(legacyLooseNotEqual(1, '2')).toBe(true);
  });

  it('exposes structured errors without losing legacy metadata', () => {
    const error = new LegacyFormulaFunctionError('CUSTOM', 'test', 'message', 'LegacyName');
    expect(error.toLegacyDetails()).toEqual({
      name: 'LegacyName',
      type: 'ExpressionFuncError',
      functionName: 'test',
      message: 'message',
    });
  });

});
