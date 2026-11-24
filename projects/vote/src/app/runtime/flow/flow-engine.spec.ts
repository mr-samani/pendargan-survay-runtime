import { FormSectionTypeEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';
import { describe, expect, it } from 'vitest';
import { buildSurveyFlow, getAdjacentSurveyFlowPage, getSurveyFlowNavigation } from './flow-engine';
import { activateSurveyLoopIteration, advanceSurveyLoop, createSurveyLoopRuntime } from './loop-runtime';
import { createInitialAnswerState } from '../state/answer-state.reducer';

function definition(): SurveyDefinition {
  return {
    id: 'survey',
    sections: [
      { id: 's1', source: {}, sourceId: 'section-db-1', uniqueIdPerForm: 'section-fid-1', type: FormSectionTypeEnum.Normal },
      { id: 's2', source: {}, sourceId: 'section-db-2', uniqueIdPerForm: 'section-fid-2', type: FormSectionTypeEnum.Normal },
      { id: 'loop', source: {}, sourceId: 'section-db-loop', uniqueIdPerForm: 'section-fid-loop', type: FormSectionTypeEnum.Loop },
      { id: 'empty', source: {}, sourceId: 'section-db-empty', uniqueIdPerForm: 'section-fid-empty', type: FormSectionTypeEnum.Normal },
    ],
    questions: [
      { id: 'q1', source: {}, sourceId: 'q-db-1', uniqueIdPerForm: 'q-fid-1', formSectionUniqueId: 'section-fid-1',
        isActive: true, isRequired: false, options: [], settings: null },
      { id: 'q2', source: {}, sourceId: 'q-db-2', uniqueIdPerForm: 'q-fid-2', formSectionUniqueId: 'section-fid-1',
        isActive: true, isRequired: false, options: [], settings: null },
      { id: 'q3', source: {}, sourceId: 'q-db-3', uniqueIdPerForm: 'q-fid-3', formSectionUniqueId: 'section-fid-2',
        isActive: true, isRequired: false, options: [], settings: null },
      { id: 'q4', source: {}, sourceId: 'q-db-4', uniqueIdPerForm: 'q-fid-4', formSectionUniqueId: 'section-fid-loop',
        isActive: true, isRequired: false, options: [], settings: null },
    ],
    expressions: [], globalVariables: [],
  };
}
function visibility(def: SurveyDefinition, overrides: Record<string, boolean | null> = {}): SurveyVisibilityResult {
  return {
    surveyId: def.id,
    questions: def.questions.map((q) => ({
      questionId: q.id, isVisible: Object.prototype.hasOwnProperty.call(overrides, q.id) ? overrides[q.id] : true, options: [],
    })),
    sections: def.sections.map((s) => ({
      sectionId: s.id, isVisible: Object.prototype.hasOwnProperty.call(overrides, s.id) ? overrides[s.id] : true, questionIds: [],
    })),
    unhandledActions: [], diagnostics: [], isValid: true,
  };
}

describe('survey flow engine', () => {
  it('builds section pages with visible questions in definition order', () => {
    const def = definition();
    const flow = buildSurveyFlow(def, visibility(def, { q2: false, s2: false }), { mode: 'section' });
    expect(flow.pages.map((page) => page.id)).toEqual(['section:s1', 'section:loop', 'section:empty']);
    expect(flow.pages[0].questionIds).toEqual(['q1']);
    expect(flow.isReady).toBe(true);
    expect(flow.pages[1].answerInstanceId).toBe('root');
    expect(flow.pages[1].loopIterationIndex).toBe(0);
  });

  it('builds one page per visible question and preserves empty visible sections', () => {
    const def = definition();
    const flow = buildSurveyFlow(def, visibility(def, { s2: false }), { mode: 'question' });
    expect(flow.pages.map((page) => page.id)).toEqual([
      'question:q1', 'question:q2', 'question:q4', 'section:empty',
    ]);
  });

  it('projects each repeated section iteration with its own answer namespace', () => {
    const def = definition();
    const initial = createSurveyLoopRuntime(def);
    const repeated = advanceSurveyLoop(def, initial, createInitialAnswerState(def), 'loop', true);
    const flow = buildSurveyFlow(def, visibility(def), {
      mode: 'section',
      loopRuntime: repeated.runtime,
    });
    const loopPages = flow.pages.filter((page) => page.sectionId === 'loop');
    expect(loopPages.map((page) => page.id)).toEqual([
      'section:loop',
      'section:loop:iteration:1',
    ]);
    expect(loopPages.map((page) => page.answerInstanceId)).toEqual([
      'root',
      'loop:loop:1',
    ]);
    expect(loopPages.map((page) => page.backendLoopNumber)).toEqual([1, 2]);
  });

  it('hides previously created future iterations when the user re-enters an earlier iteration', () => {
    const def = definition();
    const repeated = advanceSurveyLoop(
      def, createSurveyLoopRuntime(def), createInitialAnswerState(def), 'loop', true,
    );
    const backAtFirst = activateSurveyLoopIteration(repeated.runtime, 'loop', 0);
    const flow = buildSurveyFlow(def, visibility(def), { mode: 'section', loopRuntime: backAtFirst });
    expect(flow.pages.map((page) => page.id)).not.toContain('section:loop:iteration:1');
    expect(flow.pages.find((page) => page.sectionId === 'loop')?.loopIterationIndex).toBe(0);
  });

  it('expands question-per-page mode across loop iterations in section order', () => {
    const def = definition();
    const repeated = advanceSurveyLoop(
      def,
      createSurveyLoopRuntime(def),
      createInitialAnswerState(def),
      'loop',
      true,
    );
    const flow = buildSurveyFlow(def, visibility(def), {
      mode: 'question',
      loopRuntime: repeated.runtime,
    });
    const loopPages = flow.pages.filter((page) => page.sectionId === 'loop');
    expect(loopPages.map((page) => page.id)).toEqual([
      'question:q4',
      'question:q4:iteration:1',
    ]);
    expect(loopPages[1].answerInstanceId).toBe('loop:loop:1');
  });

  it('supports deterministic next/previous navigation', () => {
    const def = definition();
    const flow = buildSurveyFlow(def, visibility(def, { q3: false, empty: false }), { mode: 'question' });
    const first = getSurveyFlowNavigation(flow, 'question:q1');
    expect(first.isFirst).toBe(true);
    expect(first.canGoPrevious).toBe(false);
    expect(first.nextPage?.id).toBe('question:q2');
    expect(getAdjacentSurveyFlowPage(flow, 'question:q2', 'previous')?.id).toBe('question:q1');
    expect(getAdjacentSurveyFlowPage(flow, 'question:q2', 'next')?.id).toBe('question:q4');
  });

  it('does not put questions with unknown visibility into the navigable flow', () => {
    const def = definition();
    const flow = buildSurveyFlow(def, visibility(def, { q2: null, empty: false }), { mode: 'question' });
    expect(flow.pages.map((page) => page.id)).not.toContain('question:q2');
    expect(flow.unresolvedQuestionIds).toContain('q2');
    expect(flow.isReady).toBe(false);
  });

  it('reports a visible question without a matching section and keeps it reachable', () => {
    const def = definition();
    const withOrphan = {
      ...def,
      questions: [...def.questions, {
        id: 'orphan', source: {}, sourceId: 'orphan-db', uniqueIdPerForm: 'orphan-fid',
        formSectionUniqueId: 'missing-section', isActive: true, isRequired: false, options: [], settings: null,
      }],
    };
    const flow = buildSurveyFlow(withOrphan, visibility(withOrphan, { empty: false }), { mode: 'section' });
    expect(flow.pages.at(-1)?.id).toBe('section:unassigned');
    expect(flow.pages.at(-1)?.questionIds).toEqual(['orphan']);
  });
});
