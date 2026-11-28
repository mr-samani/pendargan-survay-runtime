import { TestBed } from '@angular/core/testing';
import { FormulaEngineService } from 'ngx-exp-parser';
import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  FormQuestionTypesEnum,
  GetAllFormDetailForViewOutputDto,
  GetFormExpressionDto,
  GetFormQuestionQuestionOptionDto,
  GetFormSectionDto,
  GetQuestionOptionDto,
} from '@service-proxies/models';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compileSurveyDefinition } from './definition.compiler';
import { compileSurveyExpressions } from './expression.compiler';
import { buildSurveyDependencyGraph } from './dependency-graph';
import { createInitialAnswerState, applyAnswerCommands } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime } from '../flow/loop-runtime';
import { evaluateSurveyFully } from './full-evaluator';
import {
  ConcreteSurveyRuntimeProjector,
  createSurveyFormulaEvaluator,
} from '../session/concrete-runtime-projector';
import { createSurveyFormulaScope } from '../session/formula-scope';

declare const process: {
  readonly version: string;
  readonly platform: string;
  readonly arch: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  memoryUsage(): { readonly heapUsed: number };
};

interface Profile {
  readonly name: string;
  readonly questions: number;
  readonly sections: number;
  readonly optionsPerQuestion: number;
  readonly expressions: number;
}

const profiles: readonly Profile[] = [
  { name: 'small', questions: 20, sections: 4, optionsPerQuestion: 3, expressions: 8 },
  { name: 'medium', questions: 250, sections: 25, optionsPerQuestion: 4, expressions: 80 },
  { name: 'large', questions: 2000, sections: 100, optionsPerQuestion: 5, expressions: 400 },
];

const WARMUP_ITERATIONS = 3;
const MEASURED_ITERATIONS = 12;

function percentile(samples: readonly number[], value: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)] ?? 0;
}

function measure<T>(operation: () => T): { readonly value: T; readonly elapsedMs: number } {
  const start = performance.now();
  const value = operation();
  return { value, elapsedMs: performance.now() - start };
}

function buildDto(profile: Profile): GetAllFormDetailForViewOutputDto {
  const sections = Array.from({ length: profile.sections }, (_, index) =>
    new GetFormSectionDto({
      uniqueId: 'section-db-' + index,
      uniqueIdPerForm: 'section-' + index,
      title: 'Section ' + index,
      firstQuestionSortKey: index,
    }),
  );
  const questions = Array.from({ length: profile.questions }, (_, index) => {
    const sectionIndex = Math.floor(index / Math.ceil(profile.questions / profile.sections));
    return new GetFormQuestionQuestionOptionDto({
      uniqueId: 'question-db-' + index,
      uniqueIdPerForm: 'question-' + index,
      questionType: FormQuestionTypesEnum.UniqueSelect,
      formSectionUniqueId: 'section-' + Math.min(sectionIndex, profile.sections - 1),
      sortKey: index,
      isActive: true,
      questionOptions: Array.from({ length: profile.optionsPerQuestion }, (_, optionIndex) =>
        new GetQuestionOptionDto({
          uniqueId: 'option-db-' + index + '-' + optionIndex,
          uniqueIdPerForm: 'option-' + index + '-' + optionIndex,
          title: 'Option ' + optionIndex,
          rowNumber: optionIndex,
        }),
      ),
    });
  });
  const expressions = Array.from({ length: profile.expressions }, (_, index) => {
    const targetQuestion = (index * 5) % profile.questions;
    return new GetFormExpressionDto({
      uniqueId: 'expression-' + index,
      expressionText: 'true',
      actionType: ExpressionActionsEnum.Show,
      targetType: ExpressionTargetsEnum.Question,
      targetKey: 'question-' + targetQuestion,
      formQuestionUniqueId: 'question-' + targetQuestion,
      formExpressionType: FormExpressionTypeEnum.InsideForm,
      isActive: true,
    });
  });
  return new GetAllFormDetailForViewOutputDto({
    formGuid: 'runtime-benchmark-' + profile.name,
    formSections: sections,
    formQuestions: questions,
    formExpressions: expressions,
  });
}

function runProfile(profile: Profile, engine: FormulaEngineService): void {
  const coldStart = performance.now();
  const definitionCompilation = compileSurveyDefinition(buildDto(profile));
  const expressionCompilation = compileSurveyExpressions(definitionCompilation, engine);
  const graph = buildSurveyDependencyGraph(definitionCompilation, expressionCompilation);
  const coldCompileMs = performance.now() - coldStart;

  expect(definitionCompilation.isValid, profile.name + ' definition compile').toBe(true);
  expect(expressionCompilation.isValid, profile.name + ' expression compile').toBe(true);
  expect(graph.isValid, profile.name + ' dependency graph').toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);

  const definition = definitionCompilation.definition;
  const answers = createInitialAnswerState(definition);
  const loops = createSurveyLoopRuntime(definition);
  const evaluator = createSurveyFormulaEvaluator(engine, createSurveyFormulaScope);
  const projector = new ConcreteSurveyRuntimeProjector(graph, expressionCompilation, {
    evaluate: evaluator,
  });
  const firstQuestionId = definition.questions[0].id;
  const scope = engine.createReactiveModel({});

  const warmEvaluation = () => evaluateSurveyFully(graph, expressionCompilation, engine, scope);
  const warmProjection = () => projector.project(definition, answers, loops, 'root');
  const answerUpdate = applyAnswerCommands(definition, answers, [{
    type: 'set-value',
    instanceId: 'root',
    questionId: firstQuestionId,
    value: 'benchmark-answer',
  }]);
  expect(answerUpdate.applied).toBe(true);
  const updatedAnswers = answerUpdate.state;

  // Prime caches and JIT paths before collecting timings.
  for (let index = 0; index < WARMUP_ITERATIONS; index++) {
    expect(warmEvaluation().isValid).toBe(true);
    expect(warmProjection().isStable).toBe(true);
    expect(projector.project(definition, updatedAnswers, loops, 'root').isStable).toBe(true);
  }

  const evaluationSamples: number[] = [];
  const projectionSamples: number[] = [];
  const updateSamples: number[] = [];
  const heapBefore = process.memoryUsage().heapUsed;
  let lastEvaluationValid = false;
  let lastProjectionStable = false;

  for (let index = 0; index < MEASURED_ITERATIONS; index++) {
    const evaluation = measure(warmEvaluation);
    evaluationSamples.push(evaluation.elapsedMs);
    lastEvaluationValid = evaluation.value.isValid;

    const projection = measure(warmProjection);
    projectionSamples.push(projection.elapsedMs);
    lastProjectionStable = projection.value.isStable;

    const update = measure(() => projector.project(definition, updatedAnswers, loops, 'root'));
    updateSamples.push(update.elapsedMs);
    lastProjectionStable = lastProjectionStable && update.value.isStable;
  }
  const heapAfter = process.memoryUsage().heapUsed;

  expect(lastEvaluationValid).toBe(true);
  expect(lastProjectionStable).toBe(true);
  console.info('[runtime-benchmark:full-profile]', JSON.stringify({
    profile: profile.name,
    fixture: {
      questions: definition.questions.length,
      sections: definition.sections.length,
      options: definition.questions.reduce((total, question) => total + question.options.length, 0),
      expressions: expressionCompilation.expressions.length,
      graphNodes: graph.nodes.length,
      graphEdges: graph.edges.length,
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      warmupIterations: WARMUP_ITERATIONS,
      measuredIterations: MEASURED_ITERATIONS,
    },
    cold: { definitionExpressionAndGraphCompileMs: Number(coldCompileMs.toFixed(3)) },
    warm: {
      fullEvaluationMs: {
        p50: Number(percentile(evaluationSamples, 0.50).toFixed(3)),
        p95: Number(percentile(evaluationSamples, 0.95).toFixed(3)),
        p99: Number(percentile(evaluationSamples, 0.99).toFixed(3)),
      },
      fullProjectorMs: {
        p50: Number(percentile(projectionSamples, 0.50).toFixed(3)),
        p95: Number(percentile(projectionSamples, 0.95).toFixed(3)),
        p99: Number(percentile(projectionSamples, 0.99).toFixed(3)),
      },
      oneAnswerProjectorPropagationMs: {
        p50: Number(percentile(updateSamples, 0.50).toFixed(3)),
        p95: Number(percentile(updateSamples, 0.95).toFixed(3)),
        p99: Number(percentile(updateSamples, 0.99).toFixed(3)),
      },
    },
    heap: {
      beforeBytes: heapBefore,
      afterBytes: heapAfter,
      retainedDeltaBytes: heapAfter - heapBefore,
      note: 'No forced GC; this is a noisy retained-heap delta, not allocation volume or peak heap.',
    },
  }));
}

const benchmarkEnabled = process.env['RUN_RUNTIME_BENCHMARKS'] === '1';

describe.runIf(benchmarkEnabled)('full runtime profile benchmark', () => {
  let engine: FormulaEngineService;

  beforeAll(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(FormulaEngineService);
  });

  afterAll(() => TestBed.resetTestingModule());

  for (const profile of profiles) {
    // The large fixture intentionally compiles 2,000 questions and 12,800 graph nodes.
    // Keep the opt-in benchmark out of Vitest's 5s default timeout on busy CI runners.
    it('profiles ' + profile.name + ' survey', () => runProfile(profile, engine), profile.name === 'large' ? 20_000 : 10_000);
  }
});

describe.runIf(!benchmarkEnabled)('full runtime profile benchmark', () => {
  it('is opt-in through RUN_RUNTIME_BENCHMARKS=1', () => {
    expect(benchmarkEnabled).toBe(false);
  });
});
