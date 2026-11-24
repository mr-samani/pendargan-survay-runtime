import { TestBed } from '@angular/core/testing';
import { FormulaEngineService } from 'ngx-exp-parser';
import { afterEach, describe, expect, it } from 'vitest';
import { createLegacyFormulaEvaluator } from './legacy-formula-evaluator';

describe('createLegacyFormulaEvaluator', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('evaluates formulas after global-before-answer token replacement', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(FormulaEngineService);
    const evaluator = createLegacyFormulaEvaluator(engine, () => 0.5);

    const result = evaluator.evaluateBoolean(
      '@Qq1.Aa1 && [%threshold%] > 3',
      ['Qq1.Aa1', '[%threshold%]'],
      { 'Qq1.Aa1': true },
      [{ title: 'Threshold', result: 5 }],
    );

    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    expect(result.missingVariables).toEqual([]);
  });

  it('evaluates custom functions through the same per-evaluator scope', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(FormulaEngineService);
    const evaluator = createLegacyFormulaEvaluator(engine, () => 0.5);

    const result = evaluator.evaluateBoolean(
      'endsWith("pendargan", "gan") && avgWeakData(1, 2, 1, 6, 2) > 4 && random(10, "stable") == 5',
      [],
      {},
    );

    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
  });

  it('retains random(key) cache across evaluations from the same evaluator', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(FormulaEngineService);
    const evaluator = createLegacyFormulaEvaluator(engine, () => 0.25);

    const first = evaluator.evaluateValue('random(20, "same-key")', [], {});
    const second = evaluator.evaluateValue('random(100, "same-key")', [], {});

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.value).toBe(second.value);
    expect(first.value).toBe(5);
  });

  it('converts missing answer-state tokens to null before parser evaluation', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(FormulaEngineService);
    const evaluator = createLegacyFormulaEvaluator(engine);

    const result = evaluator.evaluateBoolean('@missing == null', ['missing'], {});

    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
    expect(result.missingVariables).toEqual(['missing']);
  });

  it('rejects non-boolean values for action formulas while allowing scalar global-variable evaluation', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(FormulaEngineService);
    const evaluator = createLegacyFormulaEvaluator(engine);

    const booleanResult = evaluator.evaluateBoolean('5', [], {});
    const scalarResult = evaluator.evaluateValue('5', [], {});

    expect(booleanResult).toMatchObject({ success: false, value: false, error: 'Invalid' });
    expect(scalarResult).toMatchObject({ success: true, value: 5 });
  });
});
