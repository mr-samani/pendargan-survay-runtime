import type {
  DefinitionDiagnostic,
  SurveyDefinitionCompilation,
  SurveyQuestionDefinition,
} from './definition.types';
import type {
  CompiledExpression,
  CompiledGlobalVariable,
  SurveyExpressionCompilation,
} from './expression.compiler';

export type DependencyNodeKind =
  | 'question-input'
  | 'option-input'
  | 'global-variable'
  | 'formula'
  | 'scope-input'
  | 'external-reference'
  | 'action-target';

export type DependencyEdgeKind = 'reads' | 'produces' | 'triggers';

export interface SurveyDependencyNode {
  readonly id: string;
  readonly kind: DependencyNodeKind;
  readonly sourceId?: string;
  readonly path?: string;
  readonly active?: boolean;
  readonly valid?: boolean;
  readonly volatile?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SurveyDependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: DependencyEdgeKind;
}

export interface SurveyDependencyGraph {
  readonly surveyId: string;
  readonly nodes: readonly SurveyDependencyNode[];
  readonly edges: readonly SurveyDependencyEdge[];
  /** Stable Kahn order. Nodes blocked by cycles are not included. */
  readonly topologicalOrder: readonly string[];
  readonly blockedNodeIds: readonly string[];
  /** Exact strongly-connected components that contain cycles. */
  readonly cycleComponents: readonly (readonly string[])[];
  readonly diagnostics: readonly DefinitionDiagnostic[];
  readonly isValid: boolean;
}

interface OptionReference {
  readonly question: SurveyQuestionDefinition;
  readonly optionId: string;
  readonly sourceId?: string;
}

interface MutableGraph {
  nodes: Map<string, SurveyDependencyNode>;
  edges: SurveyDependencyEdge[];
  edgeKeys: Set<string>;
  diagnostics: DefinitionDiagnostic[];
}

/**
 * Builds a deterministic graph from immutable definitions and compiled expression
 * metadata. It models data reads and action outputs only; it never evaluates a
 * formula or applies an action.
 */
export function buildSurveyDependencyGraph(
  definitionInput: SurveyDefinitionCompilation,
  expressionInput: SurveyExpressionCompilation,
): SurveyDependencyGraph {
  const definition = definitionInput.definition;
  const diagnostics: DefinitionDiagnostic[] = [...expressionInput.diagnostics];

  if (!definitionInput.isValid) {
    return freezeGraph({
      surveyId: definition.id,
      nodes: [],
      edges: [],
      topologicalOrder: [],
      blockedNodeIds: [],
      cycleComponents: [],
      diagnostics,
      isValid: false,
    });
  }

  if (expressionInput.surveyId !== definition.id) {
    diagnostics.push({
      code: 'DEPENDENCY_GRAPH_SURVEY_MISMATCH',
      severity: 'error',
      path: 'surveyId',
      message: 'Definition and expression compilation belong to different surveys.',
    });
    return freezeGraph({
      surveyId: definition.id,
      nodes: [],
      edges: [],
      topologicalOrder: [],
      blockedNodeIds: [],
      cycleComponents: [],
      diagnostics,
      isValid: false,
    });
  }

  const graph: MutableGraph = {
    nodes: new Map(),
    edges: [],
    edgeKeys: new Set(),
    diagnostics,
  };

  const questionByFid = new Map<string, SurveyQuestionDefinition>();
  const optionByFid = new Map<string, OptionReference>();
  const globalVariableByReference = new Map<string, CompiledGlobalVariable[]>();

  for (const question of definition.questions) {
    const fid = toFormulaId(question.uniqueIdPerForm);
    if (fid) {
      if (questionByFid.has(fid)) {
        addDiagnostic(graph, 'DUPLICATE_QUESTION_FORMULA_KEY', 'error', question.id,
          'Multiple questions resolve to the same legacy formula key "' + fid + '".');
      } else {
        questionByFid.set(fid, question);
      }
    }

    addNode(graph, {
      id: questionNodeId(question.id),
      kind: 'question-input',
      sourceId: question.sourceId,
      active: question.isActive,
    });

    for (const option of question.options) {
      const optionFid = toFormulaId(option.uniqueIdPerForm);
      if (fid && optionFid) {
        const key = fid + '.' + optionFid;
        if (optionByFid.has(key)) {
          addDiagnostic(graph, 'DUPLICATE_OPTION_FORMULA_KEY', 'error', option.id,
            'Multiple options resolve to the same legacy formula key "' + key + '".');
        } else {
          optionByFid.set(key, {
            question,
            optionId: option.id,
            sourceId: option.sourceId,
          });
        }
      }

      addNode(graph, {
        id: optionNodeId(option.id),
        kind: 'option-input',
        sourceId: option.sourceId,
        active: question.isActive,
      });
    }
  }

  for (const variable of expressionInput.globalVariables) {
    addNode(graph, {
      id: globalVariableNodeId(variable.id),
      kind: 'global-variable',
      sourceId: variable.id,
      active: variable.isActive,
      valid: variable.isValid,
      volatile: variable.isVolatile,
    });

    for (const reference of [variable.id, variable.sourceId].filter(isNonEmpty)) {
      const current = globalVariableByReference.get(reference) ?? [];
      current.push(variable);
      globalVariableByReference.set(reference, current);
    }
  }

  for (const variable of definition.globalVariables) {
    if (!variable.uniqueIdPerForm) continue;
    const compiled = expressionInput.globalVariables.find((item) => item.id === variable.id);
    if (!compiled) continue;
    const current = globalVariableByReference.get(variable.uniqueIdPerForm) ?? [];
    if (!current.some((item) => item.id === compiled.id)) current.push(compiled);
    globalVariableByReference.set(variable.uniqueIdPerForm, current);
  }

  for (const variable of expressionInput.globalVariables) {
    if (!variable.formulaId) continue;
    const formulaId = formulaNodeId(variable.formulaId);
    addNode(graph, {
      id: formulaId,
      kind: 'formula',
      sourceId: variable.id,
      active: variable.isActive,
      valid: variable.isValid,
      volatile: variable.isVolatile,
    });

    if (variable.isCompiled) {
      for (const dependency of variable.dependencies) {
        const sourceNode = resolveDependency(
          dependency,
          questionByFid,
          optionByFid,
          globalVariableByReference,
          graph,
        );
        if (sourceNode) addEdge(graph, sourceNode, formulaId, 'reads');
      }
      addEdge(graph, formulaId, globalVariableNodeId(variable.id), 'produces');
    }
  }

  for (const expression of expressionInput.expressions) {
    const actionId = actionNodeId(expression.id);
    addNode(graph, {
      id: actionId,
      kind: 'action-target',
      sourceId: expression.id,
      active: expression.isActive,
      metadata: {
        actionType: expression.actionType,
        targetType: expression.targetType,
        targetKey: expression.targetKey,
        formQuestionUniqueId: expression.formQuestionUniqueId,
        formExpressionType: expression.formExpressionType,
      },
    });

    if (!expression.formulaId) continue;
    const formulaId = formulaNodeId(expression.formulaId);
    addNode(graph, {
      id: formulaId,
      kind: 'formula',
      sourceId: expression.id,
      active: expression.isActive,
      valid: expression.isValid,
      volatile: expression.isVolatile,
    });

    if (expression.isCompiled) {
      for (const dependency of expression.dependencies) {
        const sourceNode = resolveDependency(
          dependency,
          questionByFid,
          optionByFid,
          globalVariableByReference,
          graph,
        );
        if (sourceNode) addEdge(graph, sourceNode, formulaId, 'reads');
      }
      addEdge(graph, formulaId, actionId, 'triggers');
    }
  }

  const topological = topologicalSort(graph.nodes, graph.edges);
  const cycleComponents = findCycleComponents(graph.nodes, graph.edges);
  for (const component of cycleComponents) {
    addDiagnostic(
      graph,
      'DEPENDENCY_CYCLE',
      'error',
      component.join(' -> '),
      'Circular dependency detected between: ' + component.join(', ') + '.',
    );
  }

  const processed = new Set(topological);
  const blockedNodeIds = [...graph.nodes.keys()].filter((id) => !processed.has(id));

  return freezeGraph({
    surveyId: definition.id,
    nodes: [...graph.nodes.values()],
    edges: graph.edges,
    topologicalOrder: topological,
    blockedNodeIds,
    cycleComponents,
    diagnostics: graph.diagnostics,
    isValid: !graph.diagnostics.some((item) => item.severity === 'error'),
  });
}

function resolveDependency(
  dependency: string,
  questionByFid: ReadonlyMap<string, SurveyQuestionDefinition>,
  optionByFid: ReadonlyMap<string, OptionReference>,
  globalVariableByReference: ReadonlyMap<string, CompiledGlobalVariable[]>,
  graph: MutableGraph,
): string | undefined {
  if (dependency.startsWith('fn:')) return undefined;

  if (dependency.startsWith('[%') && dependency.endsWith('%]')) {
    const name = dependency.slice(2, -2);
    const matches = globalVariableByReference.get(name) ?? [];
    if (matches.length === 1) return globalVariableNodeId(matches[0].id);
    if (matches.length > 1) {
      addDiagnostic(graph, 'AMBIGUOUS_GLOBAL_VARIABLE_REFERENCE', 'error', dependency,
        'The variable reference matches more than one global variable.');
      return addExternalNode(graph, 'variable', dependency);
    }
    addDiagnostic(graph, 'GLOBAL_VARIABLE_REFERENCE_UNRESOLVED', 'warning', dependency,
      'No global variable with this exact ID was found; the reference remains external.');
    return addExternalNode(graph, 'variable', dependency);
  }

  if (dependency.startsWith('@')) {
    const match = /^@([^.]*)\.(.+)$/.exec(dependency);
    if (!match) {
      addDiagnostic(graph, 'ENTITY_REFERENCE_UNRESOLVED', 'warning', dependency,
        'The legacy entity reference could not be split into question and field.');
      return addExternalNode(graph, 'entity', dependency);
    }

    const entityId = match[1];
    const field = match[2];
    const fid = entityId.startsWith('Q') ? entityId.slice(1) : entityId;
    const question = questionByFid.get(fid);
    if (!question) {
      addDiagnostic(graph, 'ENTITY_QUESTION_UNRESOLVED', 'warning', dependency,
        'No question matches the legacy formula key "' + fid + '".');
      return addExternalNode(graph, 'entity', dependency);
    }

    if (field.startsWith('A')) {
      const option = optionByFid.get(fid + '.' + field.slice(1));
      if (option) return optionNodeId(option.optionId);
      addDiagnostic(graph, 'ENTITY_OPTION_UNRESOLVED', 'warning', dependency,
        'No option matches the legacy formula key "' + field + '".');
      return addExternalNode(graph, 'entity', dependency);
    }

    return questionNodeId(question.id);
  }

  const scopeId = 'scope:' + dependency;
  addNode(graph, {
    id: scopeId,
    kind: 'scope-input',
    path: dependency,
  });
  return scopeId;
}

function addExternalNode(graph: MutableGraph, kind: string, path: string): string {
  const id = 'external:' + kind + ':' + path;
  addNode(graph, { id, kind: 'external-reference', path });
  return id;
}

function addNode(graph: MutableGraph, node: SurveyDependencyNode): void {
  if (!graph.nodes.has(node.id)) graph.nodes.set(node.id, node);
}

function addEdge(
  graph: MutableGraph,
  from: string,
  to: string,
  kind: DependencyEdgeKind,
): void {
  const key = from + '\u0000' + to + '\u0000' + kind;
  if (graph.edgeKeys.has(key)) return;
  graph.edgeKeys.add(key);
  graph.edges.push({ from, to, kind });
}

function addDiagnostic(
  graph: MutableGraph,
  code: string,
  severity: 'warning' | 'error',
  path: string,
  message: string,
): void {
  graph.diagnostics.push({ code, severity, path, message });
}

function topologicalSort(
  nodes: ReadonlyMap<string, SurveyDependencyNode>,
  edges: readonly SurveyDependencyEdge[],
): string[] {
  const outgoing = new Map<string, string[]>();
  const inDegree = new Map<string, number>([...nodes.keys()].map((id) => [id, 0]));

  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const ready = [...nodes.keys()].filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];
  for (let cursor = 0; cursor < ready.length; cursor++) {
    const id = ready[cursor];
    order.push(id);
    for (const dependent of outgoing.get(id) ?? []) {
      const next = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }
  return order;
}

/** Iterative Kosaraju SCC traversal; safe for long dependency chains. */
function findCycleComponents(
  nodes: ReadonlyMap<string, SurveyDependencyNode>,
  edges: readonly SurveyDependencyEdge[],
): string[][] {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
  }

  const visited = new Set<string>();
  const finishOrder: string[] = [];

  for (const start of nodes.keys()) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const neighbors = outgoing.get(frame.id) ?? [];
      if (frame.next < neighbors.length) {
        const next = neighbors[frame.next++];
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      } else {
        finishOrder.push(frame.id);
        stack.pop();
      }
    }
  }

  const assigned = new Set<string>();
  const cycles: string[][] = [];
  for (let index = finishOrder.length - 1; index >= 0; index--) {
    const start = finishOrder[index];
    if (assigned.has(start)) continue;
    assigned.add(start);
    const component: string[] = [];
    const stack = [start];

    while (stack.length) {
      const id = stack.pop()!;
      component.push(id);
      for (const previous of incoming.get(id) ?? []) {
        if (!assigned.has(previous)) {
          assigned.add(previous);
          stack.push(previous);
        }
      }
    }

    const hasSelfLoop = (outgoing.get(start) ?? []).includes(start);
    if (component.length > 1 || hasSelfLoop) {
      cycles.push(component.sort());
    }
  }

  return cycles;
}

function toFormulaId(value: string | undefined): string | undefined {
  return value?.replace(/-/g, '') || undefined;
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function questionNodeId(id: string): string {
  return 'question:' + id;
}

function optionNodeId(id: string): string {
  return 'option:' + id;
}

function globalVariableNodeId(id: string): string {
  return 'global-variable:' + id;
}

function formulaNodeId(id: string): string {
  return 'formula:' + id;
}

function actionNodeId(id: string): string {
  return 'action:' + id;
}

function freezeGraph(value: SurveyDependencyGraph): SurveyDependencyGraph {
  for (const node of value.nodes) {
    if (node.metadata) Object.freeze(node.metadata);
    Object.freeze(node);
  }
  for (const edge of value.edges) Object.freeze(edge);
  for (const component of value.cycleComponents) Object.freeze(component);
  Object.freeze(value.nodes);
  Object.freeze(value.edges);
  Object.freeze(value.topologicalOrder);
  Object.freeze(value.blockedNodeIds);
  Object.freeze(value.cycleComponents);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
