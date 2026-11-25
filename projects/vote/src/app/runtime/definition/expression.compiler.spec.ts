import type { FormulaEngineService } from 'ngx-exp-parser';
import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  GetAllFormDetailForViewOutputDto,
  GetFormExpressionDto,
  GetFormGlobalVariableDto,
  GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';
import { describe, expect, it, vi } from 'vitest';
import { compileSurveyDefinition } from './definition.compiler';
import { compileSurveyExpressions } from './expression.compiler';
import type { SurveyDefinitionCompilation } from './definition.types';

function createDefinition(): SurveyDefinitionCompilation {
  return compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
    formGuid: 'survey-a',
    formExpressions: [
      new GetFormExpressionDto({
        uniqueId: 'show-question',
        expressionText: 'customer.active && total > 0',
        actionType: ExpressionActionsEnum.Show,
        targetType: ExpressionTargetsEnum.Question,
        targetKey: 'question-a',
        formExpressionType: FormExpressionTypeEnum.InsideForm,
        isActive: true,
      }),
      new GetFormExpressionDto({
        uniqueId: 'hide-option',
        expressionText: 'NOW() > 0',
        actionType: ExpressionActionsEnum.Hide,
        targetType: ExpressionTargetsEnum.Answer,
        targetKey: 'option-a',
        formExpressionType: FormExpressionTypeEnum.InsideForm,
        isActive: false,
      }),
    ],
    formGlobalVariables: [
      new GetFormGlobalVariableDto({
        uniqueId: 'total-variable',
        title: 'Total',
        expression: 'price * quantity',
        isActive: true,
      }),
    ],
  }));
}

describe('compileSurveyExpressions', () => {
  it('registers expressions and preserves target/action metadata and dependencies', () => {
    const registerFormula = vi.fn((id: string, expression: string) => ({
      id,
      expression,
      isValid: true,
      isVolatile: expression.includes('NOW'),
      dependencies: new Set(
        expression === 'customer.active && total > 0'
          ? ['customer.active', 'total']
          : expression === 'price * quantity'
            ? ['price', 'quantity']
            : ['fn:NOW'],
      ),
    }));
    const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;

    const result = compileSurveyExpressions(createDefinition(), engine);

    expect(result.isValid).toBe(true);
    expect(registerFormula).toHaveBeenCalledTimes(3);
    expect(result.expressions[0]).toMatchObject({
      id: 'show-question',
      actionType: ExpressionActionsEnum.Show,
      targetType: ExpressionTargetsEnum.Question,
      targetKey: 'question-a',
      isCompiled: true,
      dependencies: ['customer.active', 'total'],
    });
    expect(result.expressions[1]).toMatchObject({
      isActive: false,
      isVolatile: true,
      dependencies: ['fn:NOW'],
    });
    expect(result.globalVariables[0]).toMatchObject({
      id: 'total-variable',
      formulaId: 'survey-a::global-variable::total-variable',
      dependencies: ['price', 'quantity'],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.expressions[0].dependencies)).toBe(true);
  });

  it('reports invalid active expressions as errors and inactive ones as warnings', () => {
    const registerFormula = vi.fn((id: string, expression: string) => ({
      id,
      expression,
      isValid: false,
      error: 'Unexpected token',
      dependencies: new Set<string>(),
    }));
    const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;

    const result = compileSurveyExpressions(createDefinition(), engine);

    expect(result.isValid).toBe(false);
    expect(result.diagnostics.filter((item) => item.code === 'EXPRESSION_PARSE_FAILED')).toEqual([
      expect.objectContaining({ severity: 'error', path: 'formExpressions[0]' }),
      expect.objectContaining({ severity: 'warning', path: 'formExpressions[1]' }),
      expect.objectContaining({ severity: 'error', path: 'formGlobalVariables[0]' }),
    ]);
  });

  it('keeps dynamic-answer filters as text templates and extracts legacy references without parser registration', () => {
    const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
      formGuid: 'filter-template-survey',
      formExpressions: [
        new GetFormExpressionDto({
          uniqueId: 'dynamic-filter',
          expressionText: "Category eq @Qq1.Text and Owner eq [%Customer%] and Record eq {{Qq2.Record.Data.code}}",
          targetType: ExpressionTargetsEnum.FilterDynamicAnswer,
          isActive: true,
        }),
      ],
    }));
    const registerFormula = vi.fn();
    const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;

    const result = compileSurveyExpressions(definition, engine);

    expect(result.isValid).toBe(true);
    expect(registerFormula).not.toHaveBeenCalled();
    expect(result.expressions[0]).toMatchObject({
      id: 'dynamic-filter',
      isDynamicFilterTemplate: true,
      isCompiled: true,
      dependencies: ['@Qq1.Text', '[%Customer%]', '{{Qq2.Record.Data.code}}'],
    });
  });

  it('does not register formulas when the definition has structural errors', () => {
    const invalid = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
      formGuid: 'invalid',
      formQuestions: [
        new GetFormQuestionQuestionOptionDto({ uniqueIdPerForm: 'q1' }),
      ],
    }));
    const registerFormula = vi.fn();
    const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;

    const result = compileSurveyExpressions(invalid, engine);

    expect(result.isValid).toBe(false);
    expect(registerFormula).not.toHaveBeenCalled();
    expect(result.expressions).toHaveLength(0);
  });

  it('does not register an empty inactive expression', () => {
    const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
      formGuid: 'survey-empty',
      formExpressions: [
        new GetFormExpressionDto({
          uniqueId: 'disabled-expression',
          expressionText: '',
          isActive: false,
        }),
      ],
    }));
    const registerFormula = vi.fn();
    const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;

    const result = compileSurveyExpressions(definition, engine);

    expect(result.isValid).toBe(true);
    expect(registerFormula).not.toHaveBeenCalled();
    expect(result.expressions[0]).toMatchObject({
      isCompiled: false,
      isValid: true,
      formulaId: undefined,
    });
  });
});
