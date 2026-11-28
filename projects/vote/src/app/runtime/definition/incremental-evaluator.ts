import type {
  ExpressionValue,
  FormulaEngineService,
  FormulaValue,
} from 'ngx-exp-parser';
import type { DefinitionDiagnostic } from './definition.types';
import type {
  SurveyDependencyGraph,
  SurveyDependencyNode,
} from './dependency-graph';
import type {
  CompiledExpression,
  CompiledGlobalVariable,
  SurveyExpressionCompilation,
} from './expression.compiler';
import {
  evaluateSurveyFully,
  type EvaluatedGlobalVariable,
  type FormulaExecutionResult,
  type ProposedSurveyAction,
  type SurveyFullEvaluationResult,
} from './full-evaluator';

type EvaluationEngine = Pick<
  FormulaEngineService,
  'evaluateExpression' | 'setVariable' | 'deleteVariable' | 'variables'
>;

type FormulaEntry =
  | { readonly kind: 'expression'; readonly source: CompiledExpression; readonly expression: string }
  | { readonly kind: 'global-variable'; readonly source: CompiledGlobalVariable; readonly expression: string };

interface SavedVariable {
  readonly existed: boolean;
  readonly value: FormulaValue;
}

const FORMULA_NODE_PREFIX = 'formula:';
const GLOBAL_VARIABLE_NODE_PREFIX = 'global-variable:';

/**
 * Stateful dirty-node evaluator. The full evaluator remains the reference oracle;
 * this class only recomputes formulas reachable from explicitly changed input nodes.
 */
export class SurveyIncrementalEvaluator {
  private graph?: SurveyDependencyGraph;
  private expressions?: SurveyExpressionCompilation;
  private engine?: EvaluationEngine;
  private scope?: object;
  private currentResult?: SurveyFullEvaluationResult;

  private readonly nodes = new Map<string, SurveyDependencyNode>();
  private readonly outgoing = new Map<string, string[]>();
  private readonly incoming = new Map<string, string[]>();
  private readonly formulaEntries = new Map<string, FormulaEntry>();
  private readonly orderedFormulaEntries: FormulaEntry[] = [];
  private readonly globalVariablesById = new Map<string, CompiledGlobalVariable>();
  private readonly aliasesByVariableId = new Map<string, readonly string[]>();
  private readonly variableAliases = new Map<string, string>();
  private readonly variableAliasCollisions: string[] = [];

  private readonly formulaResults = new Map<string, FormulaExecutionResult>();
  private readonly globalVariableValues = new Map<string, FormulaValue>();
  private readonly availableVariables = new Set<string>();
  private readonly proposedActions = new Map<string, ProposedSurveyAction>();
  private readonly formulaDiagnostics = new Map<string, DefinitionDiagnostic[]>();

  initialize(
    graph: SurveyDependencyGraph,
    expressions: SurveyExpressionCompilation,
    engine: EvaluationEngine,
    scope: object,
  ): SurveyFullEvaluationResult {
    this.reset();
    this.graph = graph;
    this.expressions = expressions;
    this.engine = engine;
    this.scope = scope;

    this.prepareGraph();
    const result = evaluateSurveyFully(graph, expressions, engine, scope);
    this.loadSnapshot(result);
    this.currentResult = result;
    return result;
  }

  update(
    changedNodeIds: readonly string[],
    scope: object = this.scope!,
  ): SurveyFullEvaluationResult {
    if (!this.graph || !this.expressions || !this.engine || !this.currentResult) {
      throw new Error('SurveyIncrementalEvaluator must be initialized before update().');
    }

    this.scope = scope;
    const blockingGraphError = this.graph.cycleComponents.length > 0 ||
      this.graph.nodes.length === 0 ||
      this.graph.diagnostics.some((item) =>
        item.severity === 'error' &&
        item.code !== 'EXPRESSION_PARSE_FAILED' &&
        item.code !== 'EXPRESSION_SOURCE_EMPTY',
      );
    if (blockingGraphError) return this.currentResult;

    const transientDiagnostics: DefinitionDiagnostic[] = [];
    const dirty = new Set<string>();

    for (const nodeId of changedNodeIds) {
      if (!this.nodes.has(nodeId)) {
        transientDiagnostics.push({
          code: 'INCREMENTAL_INPUT_UNKNOWN',
          severity: 'warning',
          path: nodeId,
          message: 'The changed input ID does not exist in this dependency graph.',
        });
        continue;
      }
      this.markDependentFormulas(nodeId, dirty);
    }

    if (dirty.size === 0) {
      this.currentResult = this.createResult(transientDiagnostics);
      return this.currentResult;
    }

    const { aliases, collisions } = this.collectVariableAliases();
    if (collisions.length) {
      const diagnostics = collisions.map((alias): DefinitionDiagnostic => ({
        code: 'GLOBAL_VARIABLE_ALIAS_COLLISION',
        severity: 'error',
        path: alias,
        message: 'Multiple global variables resolve to the same runtime variable name.',
      }));
      this.currentResult = this.createResult([...transientDiagnostics, ...diagnostics]);
      return this.currentResult;
    }
    const previousVariables = this.snapshotEngineVariables(aliases);
    this.installCachedVariables(aliases);

    try {
      for (const nodeId of this.graph.topologicalOrder) {
        if (!dirty.has(nodeId)) continue;
        const entry = this.formulaEntries.get(nodeId);
        if (!entry) continue;

        const source = entry.source;
        if (!source.isActive || !source.isCompiled || !source.isValid) continue;

        const unavailableDependency = (this.incoming.get(nodeId) ?? []).find((dependencyId) => {
          if (dependencyId.startsWith(GLOBAL_VARIABLE_NODE_PREFIX)) {
            return !this.availableVariables.has(
              dependencyId.slice(GLOBAL_VARIABLE_NODE_PREFIX.length),
            );
          }
          return dependencyId.startsWith('external:variable:');
        });

        if (unavailableDependency) {
          const error = 'A required global-variable dependency is unavailable: ' + unavailableDependency;
          this.setFormulaFailure(nodeId, entry, error, 'FORMULA_DEPENDENCY_UNAVAILABLE');
          if (entry.kind === 'global-variable') {
            this.markVariableUnavailable(source.id, dirty);
          }
          continue;
        }

        const result = this.engine.evaluateExpression(entry.expression, this.scope);
        this.formulaResults.set(source.formulaId!, {
          formulaId: source.formulaId!,
          kind: entry.kind,
          sourceId: source.id,
          success: result.success,
          value: result.value,
          error: result.error,
          executionTime: result.executionTime,
        });

        if (!result.success) {
          this.setFormulaDiagnostic(nodeId, {
            code: 'FORMULA_EVALUATION_FAILED',
            severity: 'error',
            path: nodeId,
            message: result.error ?? 'Formula evaluation failed.',
          });
          if (entry.kind === 'global-variable') {
            this.markVariableUnavailable(source.id, dirty);
          } else {
            this.proposedActions.delete(source.id);
          }
          continue;
        }

        this.setFormulaDiagnostic(nodeId, undefined);

        if (entry.kind === 'global-variable') {
          if (!isFormulaValue(result.value)) {
            this.setFormulaFailure(
              nodeId,
              entry,
              'A global variable formula must return a scalar value.',
              'GLOBAL_VARIABLE_RESULT_NOT_SCALAR',
            );
            this.markVariableUnavailable(source.id, dirty);
            continue;
          }

          const wasAvailable = this.availableVariables.has(source.id);
          const previousValue = this.globalVariableValues.get(source.id);
          const changed = !wasAvailable || !Object.is(previousValue, result.value);

          this.availableVariables.add(source.id);
          this.globalVariableValues.set(source.id, result.value);
          this.setVariableAliases(entry.source as CompiledGlobalVariable, result.value);

          if (changed) this.markDependentFormulas(globalVariableNodeId(source.id), dirty);
          continue;
        }

        const expression = source as CompiledExpression;
        this.proposedActions.set(expression.id, {
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
      this.restoreEngineVariables(previousVariables);
    }

    this.currentResult = this.createResult(transientDiagnostics);
    return this.currentResult;
  }

  reset(): void {
    this.graph = undefined;
    this.expressions = undefined;
    this.engine = undefined;
    this.scope = undefined;
    this.currentResult = undefined;

    this.nodes.clear();
    this.outgoing.clear();
    this.incoming.clear();
    this.formulaEntries.clear();
    this.orderedFormulaEntries.length = 0;
    this.globalVariablesById.clear();
    this.aliasesByVariableId.clear();
    this.variableAliases.clear();
    this.variableAliasCollisions.length = 0;
    this.formulaResults.clear();
    this.globalVariableValues.clear();
    this.availableVariables.clear();
    this.proposedActions.clear();
    this.formulaDiagnostics.clear();
  }

  private prepareGraph(): void {
    const graph = this.graph!;
    const expressions = this.expressions!;

    for (const node of graph.nodes) this.nodes.set(node.id, node);
    for (const edge of graph.edges) {
      const outgoing = this.outgoing.get(edge.from) ?? [];
      outgoing.push(edge.to);
      this.outgoing.set(edge.from, outgoing);

      const incoming = this.incoming.get(edge.to) ?? [];
      incoming.push(edge.from);
      this.incoming.set(edge.to, incoming);
    }

    for (const expression of expressions.expressions) {
      if (!expression.formulaId) continue;
      this.formulaEntries.set(FORMULA_NODE_PREFIX + expression.formulaId, {
        kind: 'expression',
        source: expression,
        expression: expression.expressionText,
      });
    }

    for (const variable of expressions.globalVariables) {
      this.globalVariablesById.set(variable.id, variable);
      const aliases = getVariableAliases(variable);
      this.aliasesByVariableId.set(variable.id, aliases);
      for (const alias of aliases) {
        const existing = this.variableAliases.get(alias);
        if (existing && existing !== variable.id) this.variableAliasCollisions.push(alias);
        else this.variableAliases.set(alias, variable.id);
      }
      if (!variable.formulaId) continue;
      this.formulaEntries.set(FORMULA_NODE_PREFIX + variable.formulaId, {
        kind: 'global-variable',
        source: variable,
        expression: variable.expression,
      });
    }

    // Pre-resolve topological formula order once; updates no longer perform a
    // graph-node lookup for every node in the complete dependency graph.
    for (const nodeId of graph.topologicalOrder) {
      const entry = this.formulaEntries.get(nodeId);
      if (entry) this.orderedFormulaEntries.push(entry);
    }
  }

  private loadSnapshot(result: SurveyFullEvaluationResult): void {
    for (const formula of result.formulaResults) {
      this.formulaResults.set(formula.formulaId, formula);
    }
    for (const variable of result.globalVariableValues) {
      this.globalVariableValues.set(variable.id, variable.value);
      this.availableVariables.add(variable.id);
    }
    for (const action of result.proposedActions) {
      this.proposedActions.set(action.expressionId, action);
    }
    for (const diagnostic of result.diagnostics) {
      if (this.graph!.diagnostics.includes(diagnostic)) continue;
      const current = this.formulaDiagnostics.get(diagnostic.path) ?? [];
      current.push(diagnostic);
      this.formulaDiagnostics.set(diagnostic.path, current);
    }

    for (const variable of this.expressions!.globalVariables) {
      if (!variable.isActive || !variable.isCompiled || !variable.isValid) {
        this.availableVariables.delete(variable.id);
        this.globalVariableValues.delete(variable.id);
      }
    }
  }

  private markDependentFormulas(startNodeId: string, dirty: Set<string>): void {
    const queue = [startNodeId];
    const visited = new Set<string>();

    // A cursor avoids Array.shift()'s repeated O(n) element re-indexing.
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      if (visited.has(current)) continue;
      visited.add(current);

      for (const dependentId of this.outgoing.get(current) ?? []) {
        const dependent = this.nodes.get(dependentId);
        if (dependent?.kind === 'formula') {
          dirty.add(dependentId);
        } else if (dependent?.kind === 'global-variable') {
          queue.push(dependentId);
        }
      }
    }
  }

  private markVariableUnavailable(variableId: string, dirty: Set<string>): void {
    const wasAvailable = this.availableVariables.delete(variableId);
    this.globalVariableValues.delete(variableId);
    const variable = this.globalVariablesById.get(variableId);
    if (variable) this.setVariableAliases(variable, null);
    if (wasAvailable) this.markDependentFormulas(globalVariableNodeId(variableId), dirty);
  }

  private setFormulaFailure(
    nodeId: string,
    entry: FormulaEntry,
    error: string,
    code: string,
  ): void {
    this.formulaResults.set(entry.source.formulaId!, {
      formulaId: entry.source.formulaId!,
      kind: entry.kind,
      sourceId: entry.source.id,
      success: false,
      error,
      executionTime: 0,
    });
    this.setFormulaDiagnostic(nodeId, {
      code,
      severity: 'error',
      path: nodeId,
      message: error,
    });
    if (entry.kind === 'expression') this.proposedActions.delete(entry.source.id);
  }

  private setFormulaDiagnostic(
    nodeId: string,
    diagnostic: DefinitionDiagnostic | undefined,
  ): void {
    if (diagnostic) this.formulaDiagnostics.set(nodeId, [diagnostic]);
    else this.formulaDiagnostics.delete(nodeId);
  }

  private collectVariableAliases(): { aliases: Map<string, string>; collisions: string[] } {
    return {
      aliases: this.variableAliases,
      collisions: [...new Set(this.variableAliasCollisions)],
    };
  }

  private snapshotEngineVariables(aliases: ReadonlyMap<string, string>): Map<string, SavedVariable> {
    const current = this.engine!.variables();
    const saved = new Map<string, SavedVariable>();
    for (const alias of aliases.keys()) {
      const variable = current.get(alias);
      saved.set(alias, {
        existed: variable !== undefined,
        value: variable?.value ?? null,
      });
    }
    return saved;
  }

  private installCachedVariables(aliases: ReadonlyMap<string, string>): void {
    for (const [alias, variableId] of aliases) {
      const value = this.availableVariables.has(variableId)
        ? this.globalVariableValues.get(variableId) ?? null
        : null;
      this.engine!.setVariable(alias, value);
    }
  }

  private setVariableAliases(variable: CompiledGlobalVariable, value: FormulaValue): void {
    for (const alias of this.aliasesByVariableId.get(variable.id) ?? []) {
      this.engine!.setVariable(alias, value);
    }
  }

  private restoreEngineVariables(previous: ReadonlyMap<string, SavedVariable>): void {
    for (const [alias, saved] of previous) {
      if (saved.existed) this.engine!.setVariable(alias, saved.value);
      else this.engine!.deleteVariable(alias);
    }
  }

  private createResult(
    transientDiagnostics: readonly DefinitionDiagnostic[] = [],
  ): SurveyFullEvaluationResult {
    const graph = this.graph!;
    const expressions = this.expressions!;

    const orderedFormulaResults: FormulaExecutionResult[] = [];
    for (const entry of this.orderedFormulaEntries) {
      if (!entry.source.formulaId) continue;
      const result = this.formulaResults.get(entry.source.formulaId);
      if (result) orderedFormulaResults.push(result);
    }

    const variables: EvaluatedGlobalVariable[] = expressions.globalVariables
      .filter((item) => this.availableVariables.has(item.id))
      .map((item) => ({
        id: item.id,
        value: this.globalVariableValues.get(item.id)!,
      }));

    const actions: ProposedSurveyAction[] = expressions.expressions
      .map((item) => this.proposedActions.get(item.id))
      .filter((item): item is ProposedSurveyAction => item !== undefined);

    const diagnostics = [
      ...graph.diagnostics,
      ...[...this.formulaDiagnostics.values()].flat(),
      ...transientDiagnostics,
    ];

    return freezeResult({
      surveyId: graph.surveyId,
      formulaResults: orderedFormulaResults,
      globalVariableValues: variables,
      proposedActions: actions,
      diagnostics,
      isValid: !diagnostics.some((item) => item.severity === 'error'),
    });
  }
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

function globalVariableNodeId(id: string): string {
  return 'global-variable:' + id;
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
