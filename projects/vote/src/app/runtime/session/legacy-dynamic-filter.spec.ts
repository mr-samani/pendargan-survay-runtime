import { describe, expect, it } from 'vitest';
import type { SurveyDefinition } from '../definition/definition.types';
import type { EvaluatedDynamicFilterTemplate } from '../definition/full-evaluator';
import { resolveLegacyDynamicFilterTemplates } from './legacy-dynamic-filter';

const definition: SurveyDefinition = {
  id: 'survey',
  sections: [],
  questions: [{
    id: 'dynamic-question',
    uniqueIdPerForm: 'dynamic-fid',
    source: {},
    isActive: true,
    isRequired: false,
    options: [],
    settings: null,
  }],
  expressions: [],
  globalVariables: [{
    id: 'customer-variable',
    title: 'Customer',
    expression: '"Mina"',
    isActive: true,
    source: {},
  }],
};

const template: EvaluatedDynamicFilterTemplate = {
  expressionId: 'filter-expression',
  formulaId: 'survey::expression::filter-expression',
  targetKey: 'dynamic-fid',
  formQuestionUniqueId: 'owner-question',
  expressionText: 'Category eq @Qq1.Text and Owner eq [%Customer%]',
  dependencies: ['@Qq1.Text', '[%Customer%]'],
};

describe('resolveLegacyDynamicFilterTemplates', () => {
  it('replaces answer and global-variable references into a filter string without evaluating it', () => {
    const result = resolveLegacyDynamicFilterTemplates(
      definition,
      [template],
      { 'Qq1.Text': '"Sara"' },
      [{ id: 'customer-variable', value: 'Mina' }],
      [],
      definition.globalVariables,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      expressionId: 'filter-expression',
      questionId: 'dynamic-question',
    });
    expect(result.updates[0].value).toContain('Category eq "Sara"');
    expect(result.updates[0].value).toContain('Owner eq "Mina"');
  });

  it('uses false for a global variable whose legacy evaluation failed', () => {
    const result = resolveLegacyDynamicFilterTemplates(
      definition,
      [template],
      { 'Qq1.Text': '"Sara"' },
      [],
      [{
        formulaId: 'global-formula',
        kind: 'global-variable',
        sourceId: 'customer-variable',
        success: false,
        error: 'invalid expression',
        executionTime: 0,
      }],
      definition.globalVariables,
    );

    expect(result.updates[0].value).toContain('Owner eq false');
  });

  it('reports unresolved targets and missing answer references without guessing', () => {
    const result = resolveLegacyDynamicFilterTemplates(
      definition,
      [{ ...template, targetKey: 'unknown-fid' }],
      {},
      [],
      [],
      definition.globalVariables,
    );

    expect(result.updates).toEqual([]);
    expect(result.diagnostics[0].code).toBe('DYNAMIC_FILTER_TARGET_UNRESOLVED');
  });

  it('reports missing answer references while preserving the template update', () => {
    const result = resolveLegacyDynamicFilterTemplates(
      definition,
      [template],
      {},
      [],
      [],
      definition.globalVariables,
    );

    expect(result.updates).toHaveLength(1);
    expect(result.diagnostics.map((item) => item.code)).toContain('DYNAMIC_FILTER_REFERENCE_MISSING');
  });
});
