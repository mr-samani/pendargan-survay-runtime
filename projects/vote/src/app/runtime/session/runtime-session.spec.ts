import { describe, expect, it } from 'vitest';
import { ExpressionActionsEnum, ExpressionTargetsEnum, FormExpressionTypeEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';
import { createInitialAnswerState } from '../state/answer-state.reducer';
import { advanceSurveyLoop, createLoopAnswerInstanceId, createSurveyLoopRuntime } from '../flow/loop-runtime';
import type { SurveyFlowPage, SurveyFlowSnapshot } from '../flow/flow-engine';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';
import type { SurveyValidationResult } from '../validation/validation-engine';
import {
  createSurveyRuntimeSession,
  dispatchSurveyRuntimeCommands,
  navigateSurveyRuntimeNext,
  navigateSurveyRuntimePrevious,
  type SurveyRuntimeSessionProjector,
  type SurveyRuntimeSessionProjection,
} from './runtime-session';

const definition: SurveyDefinition = {
  id: 'survey',
  sections: [{ id: 'section', source: {}, uniqueIdPerForm: 'section-backend' }],
  questions: [{
    id: 'q', source: {}, sourceId: 'q-backend', formSectionUniqueId: 'section',
    isActive: true, isRequired: false, options: [], settings: null,
  }],
  expressions: [],
  globalVariables: [],
};

function projection(answers: ReturnType<typeof createInitialAnswerState>, valid: boolean | null = true, validationRevision = answers.revision): SurveyRuntimeSessionProjection {
  const evaluation: SurveyFullEvaluationResult = {
    surveyId: 'survey', formulaResults: [], globalVariableValues: [], proposedActions: [],
    diagnostics: [], isValid: true,
  };
  const visibility: SurveyVisibilityResult = {
    surveyId: 'survey',
    questions: [{ questionId: 'q', isVisible: true, options: [] }],
    sections: [{ sectionId: 'section', isVisible: true, questionIds: ['q'] }],
    unhandledActions: [], diagnostics: [], isValid: true,
  };
  const flow: SurveyFlowSnapshot = {
    surveyId: 'survey', mode: 'section',
    pages: [
      { id: 'page-1', kind: 'section', sectionId: 'section', questionIds: ['q'], answerInstanceId: 'root' },
      { id: 'page-2', kind: 'section', sectionId: 'section-2', questionIds: [], answerInstanceId: 'root' },
    ],
    visibleQuestionIds: ['q'], visibleSectionIds: ['section'],
    unresolvedQuestionIds: [], unresolvedSectionIds: [], diagnostics: [], isReady: true, isValid: true,
  };
  const validation: SurveyValidationResult = {
    surveyId: 'survey', instanceId: 'root', answerRevision: validationRevision,
    questions: [{ questionId: 'q', status: valid === true ? 'valid' : valid === false ? 'invalid' : 'unknown', issues: [] }],
    issues: [], isValid: valid,
  };
  return { answerState: answers, evaluation, visibility, flow, validation };
}

function projector(valid: boolean | null = true): SurveyRuntimeSessionProjector {
  return { project: (_definition, answers) => projection(answers, valid) };
}

describe('survey runtime session', () => {
  it('creates a session from matching immutable snapshots', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const result = createSurveyRuntimeSession(definition, answers, loops, projector());
    expect(result.applied).toBe(true);
    expect(result.session.currentPageId).toBe('page-1');
  });

  it('rejects navigation when current-page validation is invalid or unknown', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const invalid = createSurveyRuntimeSession(definition, answers, loops, projector(false)).session;
    expect(navigateSurveyRuntimeNext(definition, invalid, projector()).diagnostics[0].code)
      .toBe('SESSION_CURRENT_PAGE_INVALID');

    const unknown = createSurveyRuntimeSession(definition, answers, loops, projector(null)).session;
    expect(navigateSurveyRuntimeNext(definition, unknown, projector()).diagnostics[0].code)
      .toBe('SESSION_CURRENT_PAGE_INVALID');
  });

  it('applies answer commands atomically and navigates in both directions', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const initial = createSurveyRuntimeSession(definition, answers, loops, projector()).session;
    const changed = dispatchSurveyRuntimeCommands(definition, initial, [{
      type: 'set-value', instanceId: 'root', questionId: 'q', value: 'answer',
    }], projector());
    expect(changed.applied).toBe(true);
    expect(changed.session.answers.revision).toBe(1);

    const next = navigateSurveyRuntimeNext(definition, changed.session, projector());
    expect(next.session.currentPageId).toBe('page-2');
    const previous = navigateSurveyRuntimePrevious(definition, next.session, projector());
    expect(previous.session.currentPageId).toBe('page-1');
  });

  it('reactivates the previous saved loop iteration and validates its answer instance', () => {
    const loopDefinition: SurveyDefinition = {
      ...definition,
      expressions: [{
        id: 'loop-expression', expressionText: 'true', isActive: true, source: {},
        formExpressionType: FormExpressionTypeEnum.InsideForm,
        targetType: ExpressionTargetsEnum.SectionLoop, targetKey: 'section-backend',
      }],
    };
    const initialAnswers = createInitialAnswerState(loopDefinition);
    const initialLoops = createSurveyLoopRuntime(loopDefinition);
    const advanced = advanceSurveyLoop(loopDefinition, initialLoops, initialAnswers, 'section', true);
    expect(advanced.applied).toBe(true);
    const loopInstanceId = createLoopAnswerInstanceId('section', 1);

    const loopProjector: SurveyRuntimeSessionProjector = {
      project: (_definition, answers, _loops, instanceId) => {
        const result = projection(answers);
        return {
          ...result,
          flow: {
            ...result.flow,
            pages: [
              { id: 'root-page', kind: 'section', sectionId: 'section', questionIds: ['q'], answerInstanceId: 'root' },
              { id: 'loop-page-1', kind: 'section', sectionId: 'section', questionIds: ['q'],
                answerInstanceId: loopInstanceId, loopIterationIndex: 1 },
            ],
          },
          validation: { ...result.validation, instanceId },
        };
      },
    };
    const initial = createSurveyRuntimeSession(loopDefinition, initialAnswers, initialLoops, loopProjector).session;
    const onSecondIteration = Object.freeze({
      ...initial,
      answers: advanced.answerState,
      loops: advanced.runtime,
      currentPageId: 'loop-page-1',
      projection: loopProjector.project(loopDefinition, advanced.answerState, advanced.runtime, loopInstanceId),
    });
    const previous = navigateSurveyRuntimePrevious(loopDefinition, onSecondIteration, loopProjector);
    expect(previous.applied).toBe(true);
    expect(previous.session.currentPageId).toBe('root-page');
    expect(previous.session.loops.sections['section'].currentIterationIndex).toBe(0);
    expect(previous.session.projection.validation.instanceId).toBe('root');
  });

  it('rejects a projector result whose validation revision is stale', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const staleProjector: SurveyRuntimeSessionProjector = {
      project: () => projection(answers, true, answers.revision + 1),
    };
    const result = createSurveyRuntimeSession(definition, answers, loops, staleProjector);
    expect(result.applied).toBe(false);
    expect(result.diagnostics[0].code).toBe('SESSION_VALIDATION_STALE');
  });
  it('applies legacy initial values before the first session projection', () => {
    const initializedDefinition: SurveyDefinition = {
      ...definition,
      questions: [{
        ...definition.questions[0],
        source: { hasInitialValue: true },
        initialValue: 'prefilled',
      }],
    };
    const answers = createInitialAnswerState(initializedDefinition);
    const loops = createSurveyLoopRuntime(initializedDefinition);
    const result = createSurveyRuntimeSession(
      initializedDefinition, answers, loops, projector(),
    );
    expect(result.applied).toBe(true);
    expect(result.session.answers.instances['root']['q'].value).toBe('prefilled');
    expect(result.session.answers.instances['root']['q'].isDirty).toBe(false);
    expect(result.session.projection.validation.answerRevision).toBe(result.session.answers.revision);
  });

  it('initializes legacy defaults in a newly created loop answer instance', () => {
    const loopDefinition: SurveyDefinition = {
      ...definition,
      questions: [{
        ...definition.questions[0],
        source: { hasInitialValue: true },
        initialValue: 'loop-prefilled',
      }],
      expressions: [{
        id: 'loop-expression', expressionText: 'true', isActive: true, source: {},
        formExpressionType: FormExpressionTypeEnum.InsideForm,
        targetType: ExpressionTargetsEnum.SectionLoop,
        targetKey: 'section-backend',
        actionType: ExpressionActionsEnum.Show,
      }],
    };
    const answers = createInitialAnswerState(loopDefinition);
    const loops = createSurveyLoopRuntime(loopDefinition);
    const loopProjector: SurveyRuntimeSessionProjector = {
      project: (_definition, currentAnswers, currentLoops, instanceId) => {
        const loopAction = {
          expressionId: 'loop-expression',
          formulaId: 'loop-formula',
          actionType: ExpressionActionsEnum.Show,
          targetType: ExpressionTargetsEnum.SectionLoop,
          targetKey: 'section-backend',
          formExpressionType: FormExpressionTypeEnum.InsideForm,
          value: true,
          conditionMet: true,
        };
        const evaluation: SurveyFullEvaluationResult = {
          surveyId: 'survey',
          formulaResults: [],
          globalVariableValues: [],
          proposedActions: [loopAction],
          diagnostics: [],
          isValid: true,
        };
        const loopState = currentLoops.sections['section'];
        const pages: SurveyFlowPage[] = [{
          id: 'root-page', kind: 'section' as const, sectionId: 'section',
          questionIds: ['q'], answerInstanceId: 'root',
        }];
        if (loopState.currentIterationIndex > 0) {
          pages.push({
            id: 'loop-page-' + loopState.currentIterationIndex,
            kind: 'section' as const,
            sectionId: 'section',
            questionIds: ['q'],
            answerInstanceId: instanceId,
            loopIterationIndex: loopState.currentIterationIndex,
          });
        }
        return {
          answerState: currentAnswers,
          evaluation,
          visibility: {
            surveyId: 'survey',
            questions: [{ questionId: 'q', isVisible: true, options: [] }],
            sections: [{ sectionId: 'section', isVisible: true, questionIds: ['q'] }],
            unhandledActions: [],
            diagnostics: [],
            isValid: true,
          },
          flow: {
            surveyId: 'survey', mode: 'section', pages,
            visibleQuestionIds: ['q'], visibleSectionIds: ['section'],
            unresolvedQuestionIds: [], unresolvedSectionIds: [],
            diagnostics: [], isReady: true, isValid: true,
          },
          validation: {
            surveyId: 'survey', instanceId, answerRevision: currentAnswers.revision,
            questions: [{ questionId: 'q', status: 'valid', issues: [] }],
            issues: [], isValid: true,
          },
        };
      },
    };
    const initial = createSurveyRuntimeSession(loopDefinition, answers, loops, loopProjector);
    expect(initial.applied).toBe(true);
    const next = navigateSurveyRuntimeNext(loopDefinition, initial.session, loopProjector);
    expect(next.applied).toBe(true);
    const instanceId = next.session.loops.sections['section'].iterations[1].answerInstanceId;
    expect(next.session.answers.instances[instanceId]['q'].value).toBe('loop-prefilled');
    expect(next.session.answers.instances[instanceId]['q'].isDirty).toBe(false);
  });

  it('persists global-variable results and non-answer overrides per answer instance', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const received: {
      instanceId: string;
      previousValues?: Readonly<Record<string, unknown>>;
      previousEffects?: { readonly paymentAmounts: Readonly<Record<string, number>> };
    }[] = [];
    const statefulProjector: SurveyRuntimeSessionProjector = {
      project: (_definition, currentAnswers, _loops, instanceId, previousValues, previousEffects) => {
        received.push({ instanceId, previousValues, previousEffects });
        const base = projection(currentAnswers);
        return {
          ...base,
          evaluation: {
            ...base.evaluation,
            globalVariableValues: [{ id: 'global-name', value: 'Sara' }],
          },
          legacyRuntimeState: {
            paymentAmounts: { q: 125 },
            secondaryFilters: { q: 'region=north' },
          },
        };
      },
    };
    const initial = createSurveyRuntimeSession(definition, answers, loops, statefulProjector);
    expect(initial.applied).toBe(true);
    expect(initial.session.globalVariableValuesByInstance['root']['global-name']).toBe('Sara');
    expect(initial.session.legacyRuntimeStateByInstance['root'].paymentAmounts['q']).toBe(125);

    const changed = dispatchSurveyRuntimeCommands(definition, initial.session, [{
      type: 'set-value', instanceId: 'root', questionId: 'q', value: 'changed',
    }], statefulProjector);
    expect(changed.applied).toBe(true);
    expect(received).toHaveLength(2);
    expect(received[1].previousValues?.['global-name']).toBe('Sara');
    expect(received[1].previousEffects?.paymentAmounts['q']).toBe(125);
    expect(changed.session.globalVariableValuesByInstance['root']['global-name']).toBe('Sara');
    expect(changed.session.legacyRuntimeStateByInstance['root'].secondaryFilters['q']).toBe('region=north');
  });

});
