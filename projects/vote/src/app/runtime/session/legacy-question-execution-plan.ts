import { ExpressionTargetsEnum } from '@service-proxies/models';
import type { SurveyDependencyGraph } from '../definition/dependency-graph';
import type { SurveyDefinition } from '../definition/definition.types';
import type { CompiledExpression, CompiledGlobalVariable, SurveyExpressionCompilation } from '../definition/expression.compiler';

export interface LegacyQuestionExecutionStep {
  readonly questionId: string;
  readonly questionSourceId?: string;
  readonly questionIndex: number;
  /** Active global variables owned by this question, preserving API/source order. */
  readonly globalVariableIds: readonly string[];
  /** Question-scoped boolean/action expressions, excluding section and filter templates. */
  readonly expressionIds: readonly string[];
  /** Legacy Section and SectionLoop expressions are revisited at every question step. */
  readonly sectionExpressionIds: readonly string[];
  readonly sectionLoopExpressionIds: readonly string[];
  /** FilterDynamicAnswer is a text-template effect, not a boolean action. */
  readonly dynamicFilterExpressionIds: readonly string[];
  /** All expression IDs visited by the archived calculateFormulas question walk, in source order. */
  readonly questionWalkExpressionIds: readonly string[];
  /** Formula IDs in legacy phase order: owned variables, then question-walk expressions. */
  readonly formulaIds: readonly string[];
  /** Dependency-closed FormulaEngine node IDs in stable topological order. */
  readonly evaluationNodeIds: readonly string[];
}

export interface LegacyQuestionExecutionPlan {
  readonly surveyId: string;
  readonly steps: readonly LegacyQuestionExecutionStep[];
  readonly diagnostics: readonly { readonly code: string; readonly path: string; readonly message: string }[];
}

/**
 * Reconstructs the archived runFormula(questionId) walk:
 * answer-state generation -> that question's global variables in source order ->
 * optional answer-state regeneration -> question formulas plus every Section /
 * SectionLoop expression. When a graph is supplied, each step is expanded to a
 * dependency-closed topological schedule. Future-owned dependencies are pulled
 * forward only when required, then naturally run again at their owning step.
 */
export function buildLegacyQuestionExecutionPlan(
  definition: SurveyDefinition,
  compilation: SurveyExpressionCompilation,
  graph?: SurveyDependencyGraph,
): LegacyQuestionExecutionPlan {
  const diagnostics: { code: string; path: string; message: string }[] = [];
  if (definition.id !== compilation.surveyId) {
    return Object.freeze({
      surveyId: definition.id,
      steps: Object.freeze([]),
      diagnostics: Object.freeze([Object.freeze({
        code: 'LEGACY_EXECUTION_PLAN_SURVEY_MISMATCH',
        path: 'surveyId',
        message: 'Definition and expression compilation belong to different surveys.',
      })]),
    });
  }
  if (graph && graph.surveyId !== definition.id) {
    diagnostics.push({
      code: 'LEGACY_EXECUTION_GRAPH_SURVEY_MISMATCH',
      path: 'surveyId',
      message: 'The dependency graph belongs to a different survey.',
    });
  }

  const globalVariables = compilation.globalVariables.filter((item) => item.isActive);
  const expressions = compilation.expressions.filter((item) => item.isActive);
  const sectionExpressions = expressions.filter((item) => item.targetType === ExpressionTargetsEnum.Section);
  const sectionLoopExpressions = expressions.filter((item) => item.targetType === ExpressionTargetsEnum.SectionLoop);
  const dynamicFilterExpressions = expressions.filter((item) =>
    item.targetType === ExpressionTargetsEnum.FilterDynamicAnswer);
  const formulaNodeIds = new Set([
    ...compilation.globalVariables.map((item) => item.formulaId),
    ...compilation.expressions.map((item) => item.formulaId),
  ].filter((id): id is string => !!id).map((id) => formulaNodeId(id)));

  const steps = definition.questions.map((question, questionIndex) => {
    const ownsQuestion = (item: { readonly formQuestionUniqueId?: string | null }) =>
      item.formQuestionUniqueId === question.sourceId || item.formQuestionUniqueId === question.id;
    const ownedVariables = globalVariables.filter(ownsQuestion);
    const ownedExpressions = expressions.filter(ownsQuestion);
    const questionWalkExpressions = expressions.filter((item) =>
      ownsQuestion(item) ||
      item.targetType === ExpressionTargetsEnum.Section ||
      item.targetType === ExpressionTargetsEnum.SectionLoop);
    const rootFormulaIds = [
      ...ownedVariables.map((item) => item.formulaId),
      ...questionWalkExpressions.map((item) => item.formulaId),
    ].filter((id): id is string => !!id);

    return Object.freeze({
      questionId: question.id,
      questionSourceId: question.sourceId,
      questionIndex,
      globalVariableIds: Object.freeze(ownedVariables.map((item) => item.id)),
      expressionIds: Object.freeze(ownedExpressions
        .filter((item) => item.targetType !== ExpressionTargetsEnum.Section &&
          item.targetType !== ExpressionTargetsEnum.SectionLoop &&
          item.targetType !== ExpressionTargetsEnum.FilterDynamicAnswer)
        .map((item) => item.id)),
      sectionExpressionIds: Object.freeze(sectionExpressions.map((item) => item.id)),
      sectionLoopExpressionIds: Object.freeze(sectionLoopExpressions.map((item) => item.id)),
      dynamicFilterExpressionIds: Object.freeze(dynamicFilterExpressions.filter(ownsQuestion).map((item) => item.id)),
      questionWalkExpressionIds: Object.freeze(questionWalkExpressions.map((item) => item.id)),
      formulaIds: Object.freeze(rootFormulaIds),
      evaluationNodeIds: Object.freeze(graph && graph.surveyId === definition.id
        ? buildDependencyClosedSchedule(rootFormulaIds, graph, formulaNodeIds)
        : rootFormulaIds.map(formulaNodeId)),
    });
  });

  for (const variable of globalVariables) {
    if (!definition.questions.some((question) =>
      variable.formQuestionUniqueId === question.sourceId || variable.formQuestionUniqueId === question.id)) {
      diagnostics.push({
        code: 'LEGACY_GLOBAL_VARIABLE_OWNER_UNRESOLVED',
        path: variable.id,
        message: 'The global variable owner is not present in the question execution order.',
      });
    }
  }

  return Object.freeze({
    surveyId: definition.id,
    steps: Object.freeze(steps),
    diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze(item))),
  });
}

function buildDependencyClosedSchedule(
  rootFormulaIds: readonly string[],
  graph: SurveyDependencyGraph,
  formulaNodeIds: ReadonlySet<string>,
): string[] {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const sources = incoming.get(edge.to) ?? [];
    sources.push(edge.from);
    incoming.set(edge.to, sources);
  }

  const required = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    for (const dependencyId of incoming.get(nodeId) ?? []) visit(dependencyId);
    if (formulaNodeIds.has(nodeId)) required.add(nodeId);
  };
  for (const formulaId of rootFormulaIds) visit(formulaNodeId(formulaId));

  return graph.topologicalOrder.filter((nodeId) => required.has(nodeId));
}

function formulaNodeId(formulaId: string): string {
  return 'formula:' + formulaId;
}

/** Looks up a source-ordered compiled item list by IDs without changing its order. */
export function selectLegacyExecutionItems<T extends CompiledExpression | CompiledGlobalVariable>(
  items: readonly T[],
  ids: readonly string[],
): readonly T[] {
  const selected = new Set(ids);
  return Object.freeze(items.filter((item) => selected.has(item.id)));
}


/**
 * Flattens the archived question walk into one evaluation schedule.
 * Section and SectionLoop formulas intentionally remain repeated because the
 * legacy engine recalculated them after every question's global-variable phase.
 */
export function flattenLegacyQuestionExecutionPlan(
  plan: LegacyQuestionExecutionPlan,
): readonly string[] {
  const nodeIds: string[] = [];
  for (const step of plan.steps) nodeIds.push(...step.evaluationNodeIds);
  return Object.freeze(nodeIds);
}
