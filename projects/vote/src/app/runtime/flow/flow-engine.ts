import { FormSectionTypeEnum } from '@service-proxies/models';
import { isLoopSection, type SurveyLoopRuntimeSnapshot } from './loop-runtime';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';

export type SurveyFlowMode = 'section' | 'question';
export type SurveyFlowDirection = 'previous' | 'next';
export type SurveyFlowPageKind = 'section' | 'question';

export interface SurveyFlowPage {
  readonly id: string;
  readonly kind: SurveyFlowPageKind;
  readonly sectionId?: string;
  readonly sectionType?: FormSectionTypeEnum;
  readonly questionId?: string;
  readonly questionIds: readonly string[];
  readonly answerInstanceId?: string;
  readonly loopIterationIndex?: number;
  readonly backendLoopNumber?: number;
}
export interface SurveyFlowDiagnostic {
  readonly code: string;
  readonly severity: 'warning' | 'error';
  readonly path: string;
  readonly message: string;
}
export interface SurveyFlowOptions {
  readonly mode: SurveyFlowMode;
  /** Preserve visible sections with no questions as pages for static section content. Defaults to true. */
  readonly includeEmptySections?: boolean;
  readonly loopRuntime?: SurveyLoopRuntimeSnapshot;
}
export interface SurveyFlowSnapshot {
  readonly surveyId: string;
  readonly mode: SurveyFlowMode;
  readonly pages: readonly SurveyFlowPage[];
  readonly visibleQuestionIds: readonly string[];
  readonly visibleSectionIds: readonly string[];
  readonly unresolvedQuestionIds: readonly string[];
  readonly unresolvedSectionIds: readonly string[];
  readonly diagnostics: readonly SurveyFlowDiagnostic[];
  readonly isReady: boolean;
  readonly isValid: boolean;
}
export interface SurveyFlowNavigation {
  readonly currentPage?: SurveyFlowPage;
  readonly previousPage?: SurveyFlowPage;
  readonly nextPage?: SurveyFlowPage;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
}

/** Builds a stable flow projection; it does not mutate state or implement loop expansion. */
export function buildSurveyFlow(
  definition: SurveyDefinition,
  visibility: SurveyVisibilityResult,
  options: SurveyFlowOptions,
): SurveyFlowSnapshot {
  const diagnostics: SurveyFlowDiagnostic[] = [];
  const pages: SurveyFlowPage[] = [];
  const unresolvedQuestionIds: string[] = [];
  const unresolvedSectionIds: string[] = [];
  const visibleQuestionIds = new Set<string>();
  const visibleSectionIds = new Set<string>();
  const questionVisibility = new Map(visibility.questions.map((item) => [item.questionId, item.isVisible]));
  const sectionVisibility = new Map(visibility.sections.map((item) => [item.sectionId, item.isVisible]));
  if (options.loopRuntime && options.loopRuntime.surveyId !== definition.id) {
    diagnostics.push({ code: 'FLOW_LOOP_RUNTIME_SURVEY_MISMATCH', severity: 'error', path: 'loopRuntime.surveyId',
      message: 'Loop runtime belongs to a different survey definition.' });
  }

  if (definition.id !== visibility.surveyId) {
    diagnostics.push({
      code: 'FLOW_SURVEY_MISMATCH', severity: 'error', path: 'surveyId',
      message: 'Definition and visibility projection belong to different surveys.',
    });
    return freezeFlow({
      surveyId: definition.id, mode: options.mode, pages: [],
      visibleQuestionIds: [], visibleSectionIds: [], unresolvedQuestionIds: [],
      unresolvedSectionIds: [], diagnostics, isReady: false, isValid: false,
    });
  }

  for (const question of definition.questions) {
    const value = questionVisibility.get(question.id) ?? null;
    if (value === true && question.isActive) visibleQuestionIds.add(question.id);
    else if (value === null && question.isActive) {
      unresolvedQuestionIds.push(question.id);
      diagnostics.push({
        code: 'FLOW_QUESTION_VISIBILITY_UNKNOWN', severity: 'warning', path: question.id,
        message: 'Question visibility is unknown; it is not added to the navigable flow.',
      });
    }
  }

  for (const section of definition.sections) {
    const value = sectionVisibility.get(section.id) ?? null;
    if (value === true) visibleSectionIds.add(section.id);
    else if (value === null) {
      unresolvedSectionIds.push(section.id);
      diagnostics.push({
        code: 'FLOW_SECTION_VISIBILITY_UNKNOWN', severity: 'warning', path: section.id,
        message: 'Section visibility is unknown; it is not added to the navigable flow.',
      });
    }
  }

  const sectionByReference = new Map<string, string>();
  for (const section of definition.sections) {
    for (const reference of [section.id, section.sourceId, section.uniqueIdPerForm]) {
      if (reference) sectionByReference.set(reference, section.id);
    }
  }
  for (const questionId of [...visibleQuestionIds]) {
    const question = definition.questions.find((item) => item.id === questionId)!;
    const sectionId = question.formSectionUniqueId
      ? sectionByReference.get(question.formSectionUniqueId)
      : undefined;
    if (!sectionId) continue;
    const sectionValue = sectionVisibility.get(sectionId) ?? null;
    if (sectionValue === false) {
      visibleQuestionIds.delete(questionId);
    } else if (sectionValue === null) {
      visibleQuestionIds.delete(questionId);
      if (!unresolvedQuestionIds.includes(questionId)) unresolvedQuestionIds.push(questionId);
      diagnostics.push({
        code: 'FLOW_PARENT_SECTION_VISIBILITY_UNKNOWN', severity: 'warning', path: questionId,
        message: 'The owning section visibility is unknown; this question is not added to the navigable flow.',
      });
    }
  }

  const questionsBySection = new Map<string, string[]>();
  const unassignedQuestions: string[] = [];
  for (const question of definition.questions) {
    if (!visibleQuestionIds.has(question.id)) continue;
    const sectionId = question.formSectionUniqueId
      ? sectionByReference.get(question.formSectionUniqueId)
      : undefined;
    if (!sectionId) {
      unassignedQuestions.push(question.id);
      diagnostics.push({
        code: 'FLOW_QUESTION_SECTION_UNRESOLVED', severity: 'warning', path: question.id,
        message: 'Visible question has no matching section and is placed in the unassigned flow group.',
      });
      continue;
    }
    const list = questionsBySection.get(sectionId) ?? [];
    list.push(question.id);
    questionsBySection.set(sectionId, list);
  }

  if (options.mode === 'section') {
    for (const section of definition.sections) {
      if (!visibleSectionIds.has(section.id)) continue;
      const memberQuestions = questionsBySection.get(section.id) ?? [];
      for (const iteration of getSectionIterations(definition, section.id, options.loopRuntime)) {
        pages.push(createSectionPage(
          section.id,
          section.type,
          memberQuestions,
          getSectionPageId(section.id, iteration.iterationIndex, isLoopSection(definition, section)),
          iteration,
        ));
      }
    }
    if (unassignedQuestions.length) {
      pages.push(createSectionPage(undefined, undefined, unassignedQuestions, 'section:unassigned'));
    }
  } else {
    for (const section of definition.sections) {
      if (!visibleSectionIds.has(section.id)) continue;
      const memberQuestions = questionsBySection.get(section.id) ?? [];
      const iterations = getSectionIterations(definition, section.id, options.loopRuntime);
      if (!memberQuestions.length && options.includeEmptySections !== false) {
        const hasAnyDefinitionQuestion = definition.questions.some((question) =>
          question.formSectionUniqueId === section.id ||
          question.formSectionUniqueId === section.sourceId ||
          question.formSectionUniqueId === section.uniqueIdPerForm);
        if (!hasAnyDefinitionQuestion) {
          for (const iteration of iterations) {
            pages.push(createSectionPage(
              section.id,
              section.type,
              [],
              getSectionPageId(section.id, iteration.iterationIndex, isLoopSection(definition, section)),
              iteration,
            ));
          }
        }
        continue;
      }
      for (const iteration of iterations) {
        for (const questionId of memberQuestions) {
          pages.push(Object.freeze({
            id: getQuestionPageId(questionId, iteration.iterationIndex, isLoopSection(definition, section)),
            kind: 'question',
            sectionId: section.id,
            questionId,
            questionIds: Object.freeze([questionId]),
            answerInstanceId: iteration.answerInstanceId,
            loopIterationIndex: isLoopSection(definition, section) ? iteration.iterationIndex : undefined,
            backendLoopNumber: isLoopSection(definition, section) ? iteration.backendLoopNumber : undefined,
          }));
        }
      }
    }
    for (const questionId of unassignedQuestions) {
      pages.push(Object.freeze({
        id: 'question:' + questionId,
        kind: 'question',
        questionId,
        questionIds: Object.freeze([questionId]),
        answerInstanceId: 'root',
      }));
    }
  }

  const isReady = unresolvedQuestionIds.length === 0 &&
    unresolvedSectionIds.length === 0 &&
    !diagnostics.some((item) => item.severity === 'error');
  return freezeFlow({
    surveyId: definition.id,
    mode: options.mode,
    pages,
    visibleQuestionIds: [...visibleQuestionIds],
    visibleSectionIds: [...visibleSectionIds],
    unresolvedQuestionIds,
    unresolvedSectionIds,
    diagnostics,
    isReady,
    isValid: !diagnostics.some((item) => item.severity === 'error'),
  });
}

export function getSurveyFlowNavigation(
  flow: SurveyFlowSnapshot,
  currentPageId: string | undefined,
): SurveyFlowNavigation {
  if (!flow.pages.length) {
    return Object.freeze({
      isFirst: true, isLast: true, canGoPrevious: false, canGoNext: false,
    });
  }
  const index = currentPageId
    ? flow.pages.findIndex((page) => page.id === currentPageId)
    : -1;
  if (index < 0) {
    return Object.freeze({
      isFirst: true, isLast: false, canGoPrevious: false, canGoNext: true,
      nextPage: flow.pages[0],
    });
  }
  return Object.freeze({
    currentPage: flow.pages[index],
    previousPage: index > 0 ? flow.pages[index - 1] : undefined,
    nextPage: index < flow.pages.length - 1 ? flow.pages[index + 1] : undefined,
    isFirst: index === 0,
    isLast: index === flow.pages.length - 1,
    canGoPrevious: index > 0,
    canGoNext: index < flow.pages.length - 1,
  });
}

export function getAdjacentSurveyFlowPage(
  flow: SurveyFlowSnapshot,
  currentPageId: string | undefined,
  direction: SurveyFlowDirection,
): SurveyFlowPage | undefined {
  const navigation = getSurveyFlowNavigation(flow, currentPageId);
  return direction === 'next' ? navigation.nextPage : navigation.previousPage;
}

interface FlowIteration {
  readonly iterationIndex: number;
  readonly backendLoopNumber: number;
  readonly answerInstanceId: string;
}
function getSectionIterations(
  definition: SurveyDefinition,
  sectionId: string,
  runtime?: SurveyLoopRuntimeSnapshot,
): readonly FlowIteration[] {
  const section = definition.sections.find((item) => item.id === sectionId);
  if (!section || !isLoopSection(definition, section)) {
    return [{ iterationIndex: 0, backendLoopNumber: 1, answerInstanceId: 'root' }];
  }
  const saved = runtime?.sections[sectionId]?.iterations;
  return saved?.length
    ? saved.filter((item) => item.iterationIndex <= (runtime?.sections[sectionId]?.currentIterationIndex ?? 0)).map((item) => ({
        iterationIndex: item.iterationIndex,
        backendLoopNumber: item.backendLoopNumber,
        answerInstanceId: item.answerInstanceId,
      }))
    : [{ iterationIndex: 0, backendLoopNumber: 1, answerInstanceId: 'root' }];
}
function getSectionPageId(sectionId: string, iterationIndex: number, isLoop: boolean): string {
  return isLoop && iterationIndex > 0
    ? 'section:' + sectionId + ':iteration:' + iterationIndex
    : 'section:' + sectionId;
}
function getQuestionPageId(questionId: string, iterationIndex: number, isLoop: boolean): string {
  return isLoop && iterationIndex > 0
    ? 'question:' + questionId + ':iteration:' + iterationIndex
    : 'question:' + questionId;
}
function createSectionPage(
  sectionId: string | undefined,
  sectionType: FormSectionTypeEnum | undefined,
  questionIds: readonly string[],
  id = 'section:' + (sectionId ?? 'unassigned'),
  iteration?: FlowIteration,
): SurveyFlowPage {
  return Object.freeze({
    id,
    kind: 'section',
    sectionId,
    sectionType,
    questionIds: Object.freeze([...questionIds]),
    answerInstanceId: iteration?.answerInstanceId ?? 'root',
    loopIterationIndex: iteration?.iterationIndex,
    backendLoopNumber: iteration?.backendLoopNumber,
  });
}

function freezeFlow(value: SurveyFlowSnapshot): SurveyFlowSnapshot {
  for (const page of value.pages) {
    Object.freeze(page.questionIds);
    Object.freeze(page);
  }
  for (const item of value.diagnostics) Object.freeze(item);
  Object.freeze(value.pages);
  Object.freeze(value.visibleQuestionIds);
  Object.freeze(value.visibleSectionIds);
  Object.freeze(value.unresolvedQuestionIds);
  Object.freeze(value.unresolvedSectionIds);
  Object.freeze(value.diagnostics);
  return Object.freeze(value);
}
