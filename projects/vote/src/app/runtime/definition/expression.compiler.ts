import type { FormulaEngineService } from 'ngx-exp-parser';
import type {
  DefinitionDiagnostic,
  SurveyDefinitionCompilation,
  SurveyExpressionDefinition,
  SurveyGlobalVariableDefinition,
} from './definition.types';

export interface CompiledExpression {
  readonly id: string;
  readonly formulaId?: string;
  readonly expressionText: string;
  readonly actionType: SurveyExpressionDefinition['actionType'];
  readonly targetType: SurveyExpressionDefinition['targetType'];
  readonly targetKey?: string | null;
  readonly formQuestionUniqueId?: string | null;
  readonly formExpressionType: SurveyExpressionDefinition['formExpressionType'];
  readonly isActive: boolean;
  readonly isCompiled: boolean;
  readonly isVolatile: boolean;
  readonly isValid: boolean;
  readonly dependencies: readonly string[];
}

export interface CompiledGlobalVariable {
  readonly id: string;
  readonly formulaId?: string;
  readonly title: string;
  readonly expression: string;
  readonly type: SurveyGlobalVariableDefinition['type'];
  readonly isActive: boolean;
  readonly isCompiled: boolean;
  readonly isVolatile: boolean;
  readonly isValid: boolean;
  readonly dependencies: readonly string[];
}

export interface SurveyExpressionCompilation {
  readonly surveyId: string;
  readonly expressions: readonly CompiledExpression[];
  readonly globalVariables: readonly CompiledGlobalVariable[];
  readonly diagnostics: readonly DefinitionDiagnostic[];
  readonly isValid: boolean;
}

type FormulaRegistrar = Pick<FormulaEngineService, 'registerFormula'>;

/**
 * Parses each expression once through ngx-exp-parser and captures its dependency
 * metadata. The caller supplies the formula-engine instance so its registry scope
 * remains an explicit runtime decision.
 *
 * This stage registers formulas but never evaluates them or executes actions.
 */
export function compileSurveyExpressions(
  input: SurveyDefinitionCompilation,
  engine: FormulaRegistrar,
): SurveyExpressionCompilation {
  const diagnostics: DefinitionDiagnostic[] = [...input.diagnostics];

  if (!input.isValid) {
    return freezeCompilation({
      surveyId: input.definition.id,
      expressions: [],
      globalVariables: [],
      diagnostics,
      isValid: false,
    });
  }

  const expressions = input.definition.expressions.map((source, index) =>
    compileExpression(source, index, input.definition.id, engine, diagnostics),
  );

  const globalVariables = input.definition.globalVariables.map((source, index) =>
    compileGlobalVariable(source, index, input.definition.id, engine, diagnostics),
  );

  return freezeCompilation({
    surveyId: input.definition.id,
    expressions,
    globalVariables,
    diagnostics,
    isValid: !diagnostics.some((item) => item.severity === 'error'),
  });
}

function compileExpression(
  source: SurveyExpressionDefinition,
  index: number,
  surveyId: string,
  engine: FormulaRegistrar,
  diagnostics: DefinitionDiagnostic[],
): CompiledExpression {
  const path = 'formExpressions[' + index + ']';
  const formulaId = surveyId + '::expression::' + source.id;
  const result = compileFormula(
    source.expressionText,
    source.isActive,
    formulaId,
    path,
    engine,
    diagnostics,
  );

  return {
    id: source.id,
    formulaId: result.formulaId,
    expressionText: source.expressionText,
    actionType: source.actionType,
    targetType: source.targetType,
    targetKey: source.targetKey,
    formQuestionUniqueId: source.formQuestionUniqueId,
    formExpressionType: source.formExpressionType,
    isActive: source.isActive,
    isCompiled: result.isCompiled,
    isVolatile: result.isVolatile,
    isValid: result.isValid,
    dependencies: result.dependencies,
  };
}

function compileGlobalVariable(
  source: SurveyGlobalVariableDefinition,
  index: number,
  surveyId: string,
  engine: FormulaRegistrar,
  diagnostics: DefinitionDiagnostic[],
): CompiledGlobalVariable {
  const path = 'formGlobalVariables[' + index + ']';
  const formulaId = surveyId + '::global-variable::' + source.id;
  const result = compileFormula(
    source.expression,
    source.isActive,
    formulaId,
    path,
    engine,
    diagnostics,
  );

  return {
    id: source.id,
    formulaId: result.formulaId,
    title: source.title,
    expression: source.expression,
    type: source.type,
    isActive: source.isActive,
    isCompiled: result.isCompiled,
    isVolatile: result.isVolatile,
    isValid: result.isValid,
    dependencies: result.dependencies,
  };
}

function compileFormula(
  expression: string,
  isActive: boolean,
  formulaId: string,
  path: string,
  engine: FormulaRegistrar,
  diagnostics: DefinitionDiagnostic[],
): {
  formulaId?: string;
  isCompiled: boolean;
  isVolatile: boolean;
  isValid: boolean;
  dependencies: readonly string[];
} {
  if (!expression.trim()) {
    if (isActive) {
      diagnostics.push({
        code: 'EXPRESSION_SOURCE_EMPTY',
        severity: 'error',
        path,
        message: 'An active expression must contain source text.',
      });
    }

    return {
      isCompiled: false,
      isVolatile: false,
      isValid: !isActive,
      dependencies: [],
    };
  }

  const formula = engine.registerFormula(formulaId, expression);
  if (!formula.isValid) {
    diagnostics.push({
      code: 'EXPRESSION_PARSE_FAILED',
      severity: isActive ? 'error' : 'warning',
      path,
      message: formula.error ?? 'The expression parser rejected this expression.',
    });
  }

  return {
    formulaId,
    isCompiled: formula.isValid,
    isVolatile: formula.isVolatile === true,
    isValid: formula.isValid,
    dependencies: [...formula.dependencies],
  };
}

function freezeCompilation(
  value: SurveyExpressionCompilation,
): SurveyExpressionCompilation {
  for (const expression of value.expressions) {
    Object.freeze(expression.dependencies);
    Object.freeze(expression);
  }
  for (const variable of value.globalVariables) {
    Object.freeze(variable.dependencies);
    Object.freeze(variable);
  }
  Object.freeze(value.expressions);
  Object.freeze(value.globalVariables);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
