import type {
  ExpressionValue,
  FormulaEngineService,
  FormulaValue,
} from 'ngx-exp-parser';
import type { DefinitionDiagnostic } from './definition.types';
import type { SurveyDependencyGraph } from './dependency-graph';
import type {
  CompiledExpression,
  CompiledGlobalVariable,
  SurveyExpressionCompilation,
} from './expression.compiler';

export interface FormulaExecutionResult {
  readonly formulaId: string;
  readonly kind: 'expression' | 'global-variable';
  readonly sourceId: string;
  readonly success: boolean;
  readonly value?: ExpressionValue;
  readonly error?: string;
  readonly executionTime: number;
}

export interface EvaluatedGlobalVariable {
  readonly id: string;
  readonly value: FormulaValue;
}

export interface ProposedSurveyAction {
  readonly expressionId: string;
  readonly formulaId: string;
  readonly actionType: CompiledExpression['actionType'];
  readonly targetType: CompiledExpression['targetType'];
  readonly targetKey?: string | null;
  readonly formQuestionUniqueId?: string | null;
  readonly formExpressionType: CompiledExpression['formExpressionType'];
  readonly value: ExpressionValue;
  readonly conditionMet: boolean;
}

export interface SurveyFullEvaluationResult {
  readonly surveyId: string;
  readonly formulaResults: readonly FormulaExecutionResult[];
  readonly globalVariableValues: readonly EvaluatedGlobalVariable[];
  readonly proposedActions: readonly ProposedSurveyAction[];
  readonly diagnostics: readonly DefinitionDiagnostic[];
  readonly isValid: boolean;
}

type EvaluationEngine = Pick<
  FormulaEngineService,
  'evaluateExpression' | 'setVariable' | 'deleteVariable' | 'variables'
>;

interface SavedVariable {
  readonly existed: boolean;
  readonly value: FormulaValue;
}

interface FormulaEntry {
  readonly kind: 'expression' | 'global-variable';
  readonly expression: string;
  readonly source: CompiledExpression | CompiledGlobalVariable;
}

const FORMULA_NODE_PREFIX = 'formula:';
const GLOBAL_VARIABLE_NODE_PREFIX = 'global-variable:';

/**
 * Full-recalculation reference evaluator.
 *
 * It evaluates registered source against one supplied answer snapshot, calculates
 * global variables in graph order, and returns action proposals. It never mutates
 * answer state or applies actions.
 */
export function evaluateSurveyFully(
  graph: SurveyDependencyGraph,
  expressions: SurveyExpressionCompilation,
  engine: EvaluationEngine,
  scope: object,
): SurveyFullEvaluationResult {
  const diagnostics: DefinitionDiagnostic[] = [...graph.diagnostics];
  const formulaResults: FormulaExecutionResult[] = [];
  const globalVariableValues: EvaluatedGlobalVariable[] = [];
  const proposedActions: ProposedSurveyAction[] = [];

  if (graph.cycleComponents.length > 0 || graph.nodes.length === 0) {
    return freezeResult({
      surveyId: graph.surveyId,
      formulaResults,
      globalVariableValues,
      proposedActions,
      diagnostics,
      isValid: false,
    });
  }

  const formulaByNode = new Map<string, FormulaEntry>();
  const expressionByFormulaId = new Map<string, CompiledExpression>();
  const variableByFormulaId = new Map<string, CompiledGlobalVariable>();

  for (const expression of expressions.expressions) {
    if (!expression.formulaId) continue;
    const nodeId = FORMULA_NODE_PREFIX + expression.formulaId;
    formulaByNode.set(nodeId, {
      kind: 'expression',
      expression: expression.expressionText,
      source: expression,
    });
    expressionByFormulaId.set(expression.formulaId, expression);
  }

  for (const variable of expressions.globalVariables) {
    if (!variable.formulaId) continue;
    const nodeId = FORMULA_NODE_PREFIX + variable.formulaId;
    formulaByNode.set(nodeId, {
      kind: 'global-variable',
      expression: variable.expression,
      source: variable,
    });
    variableByFormulaId.set(variable.formulaId, variable);
  }

  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = incoming.get(edge.to) ?? [];
    list.push(edge.from);
    incoming.set(edge.to, list);
  }

  const unavailableVariables = new Set<string>();
  for (const variable of expressions.globalVariables) {
    if (!variable.isActive || !variable.isCompiled || !variable.isValid) {
      unavailableVariables.add(variable.id);
    }
  }

  const variableAliases = new Map<string, string>();
  for (const variable of expressions.globalVariables) {
    for (const alias of getVariableAliases(variable)) {
      const existing = variableAliases.get(alias);
      if (existing && existing !== variable.id) {
        diagnostics.push({
          code: 'GLOBAL_VARIABLE_ALIAS_COLLISION',
          severity: 'error',
          path: alias,
          message: 'Multiple global variables resolve to the same runtime variable name.',
        });
      } else {
        variableAliases.set(alias, variable.id);
      }
    }
  }

  if (diagnostics.some((item) => item.severity === 'error' && item.code !== 'EXPRESSION_PARSE_FAILED' && item.code !== 'EXPRESSION_SOURCE_EMPTY')) {
    return freezeResult({
      surveyId: graph.surveyId,
      formulaResults,
      globalVariableValues,
      proposedActions,
      diagnostics,
      isValid: false,
    });
  }

  const previousVariables = new Map<string, SavedVariable>();
  const before = engine.variables();

  for (const alias of variableAliases.keys()) {
    const previous = before.get(alias);
    previousVariables.set(alias, {
      existed: previous !== undefined,
      value: previous?.value ?? null,
    });
    // Clear previous-survey values so an unresolved/failed formula cannot read stale data.
    engine.setVariable(alias, null);
  }

  try {
    for (const nodeId of graph.topologicalOrder) {
      const entry = formulaByNode.get(nodeId);
      if (!entry) continue;

      const source = entry.source;
      if (!source.isActive || !source.isCompiled || !source.isValid) continue;

      const unavailableDependency = (incoming.get(nodeId) ?? []).find((dependencyId) => {
        if (dependencyId.startsWith(GLOBAL_VARIABLE_NODE_PREFIX)) {
          return unavailableVariables.has(dependencyId.slice(GLOBAL_VARIABLE_NODE_PREFIX.length));
        }
        return dependencyId.startsWith('external:variable:');
      });

      if (unavailableDependency) {
        const error = 'A required global-variable dependency is unavailable: ' + unavailableDependency;
        diagnostics.push({
          code: 'FORMULA_DEPENDENCY_UNAVAILABLE',
          severity: 'error',
          path: nodeId,
          message: error,
        });
        formulaResults.push({
          formulaId: source.formulaId!,
          kind: entry.kind,
          sourceId: source.id,
          success: false,
          error,
          executionTime: 0,
        });
        if (entry.kind === 'global-variable') unavailableVariables.add(source.id);
        continue;
      }

      const result = engine.evaluateExpression(entry.expression, scope);
      formulaResults.push({
        formulaId: source.formulaId!,
        kind: entry.kind,
        sourceId: source.id,
        success: result.success,
        value: result.value,
        error: result.error,
        executionTime: result.executionTime,
      });

      if (!result.success) {
        diagnostics.push({
          code: 'FORMULA_EVALUATION_FAILED',
          severity: 'error',
          path: nodeId,
          message: result.error ?? 'Formula evaluation failed.',
        });
        if (entry.kind === 'global-variable') unavailableVariables.add(source.id);
        continue;
      }

      if (entry.kind === 'global-variable') {
        if (!isFormulaValue(result.value)) {
          const error = 'A global variable formula must return a scalar value.';
          diagnostics.push({
            code: 'GLOBAL_VARIABLE_RESULT_NOT_SCALAR',
            severity: 'error',
            path: nodeId,
            message: error,
          });
          unavailableVariables.add(source.id);
          continue;
        }

        globalVariableValues.push({ id: source.id, value: result.value });
        for (const alias of getVariableAliases(source as CompiledGlobalVariable)) {
          engine.setVariable(alias, result.value);
        }
        continue;
      }

      const expression = source as CompiledExpression;
      proposedActions.push({
        expressionId: expression.id,
        formulaId: expression.formulaId!,
        actionType: expression.actionType,
        targetType: expression.targetType,
        targetKey: expression.targetKey,
        formQuestionUniqueId: expression.formQuestionUniqueId,
        formExpressionType: expression.formExpressionType,
        value: result.value,
        conditionMet: Boolean(result.value),
      });
    }
  } finally {
    for (const [alias, saved] of previousVariables) {
      if (saved.existed) engine.setVariable(alias, saved.value);
      else engine.deleteVariable(alias);
    }
  }

  return freezeResult({
    surveyId: graph.surveyId,
    formulaResults,
    globalVariableValues,
    proposedActions,
    diagnostics,
    isValid: !diagnostics.some((item) => item.severity === 'error'),
  });
}

function getVariableAliases(variable: CompiledGlobalVariable): string[] {
  return [...new Set(
    [variable.id, variable.sourceId, variable.uniqueIdPerForm]
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )];
}

function isFormulaValue(value: ExpressionValue | undefined): value is FormulaValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function freezeResult(value: SurveyFullEvaluationResult): SurveyFullEvaluationResult {
  for (const result of value.formulaResults) Object.freeze(result);
  for (const variable of value.globalVariableValues) Object.freeze(variable);
  for (const action of value.proposedActions) Object.freeze(action);
  for (const diagnostic of value.diagnostics) Object.freeze(diagnostic);
  Object.freeze(value.formulaResults);
  Object.freeze(value.globalVariableValues);
  Object.freeze(value.proposedActions);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
