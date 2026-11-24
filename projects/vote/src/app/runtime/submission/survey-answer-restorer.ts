import {
  FormQuestionTypesEnum,
  GetFormQuestionAnswerDto,
  GetTempVoterForLoadDto,
  GetVoterFullDetail,
} from '@service-proxies/models';
import type { SurveyDefinition, SurveySectionDefinition } from '../definition/definition.types';
import { createInitialAnswerState, hydrateAnswerInstance } from '../state/answer-state.reducer';
import type { AnswerStateSnapshot } from '../state/answer-state.types';
import {
  advanceSurveyLoop,
  createSurveyLoopRuntime,
  isLoopSection,
  setSurveyLoopIterationFilled,
} from '../flow/loop-runtime';
import type { SurveyLoopRuntimeSnapshot } from '../flow/loop-runtime';
import {
  restoreQuestionAnswer,
  type QuestionAnswerRestoreDiagnostic,
} from './question-answer-restorer';

export interface SurveyRestoreDiagnostic {
  readonly code: string;
  readonly severity: 'warning' | 'error';
  readonly path: string;
  readonly message: string;
}
export interface SurveyRestoreResult {
  readonly answerState: AnswerStateSnapshot;
  readonly loopRuntime: SurveyLoopRuntimeSnapshot;
  readonly elapsedTime: number;
  readonly completionPercentage?: number;
  readonly diagnostics: readonly SurveyRestoreDiagnostic[];
  readonly isValid: boolean;
}

/**
 * Restores server question/loop DTOs into immutable runtime snapshots.
 * The traversal preserves the legacy one-based backend / zero-based UI loop index.
 */
export function restoreSurveyFromBackend(
  definition: SurveyDefinition,
  voter: GetVoterFullDetail,
  temporary?: GetTempVoterForLoadDto,
): SurveyRestoreResult {
  const diagnostics: SurveyRestoreDiagnostic[] = [];
  let answerState = createInitialAnswerState(definition);
  let loopRuntime = createSurveyLoopRuntime(definition);

  if (!voter.formSections) {
    diagnostics.push({
      code: 'RESTORE_FORM_SECTIONS_MISSING',
      severity: 'error',
      path: 'formSections',
      message: 'The saved voter does not contain form section answer data.',
    });
    return freezeResult(answerState, loopRuntime, temporary, diagnostics);
  }

  for (const savedSection of voter.formSections) {
    const section = definition.sections.find((item) =>
      item.uniqueIdPerForm === savedSection.formSectionUniqueId ||
      item.sourceId === savedSection.formSectionUniqueId ||
      item.id === savedSection.formSectionUniqueId);
    if (!section) {
      diagnostics.push({
        code: 'RESTORE_SECTION_NOT_IN_DEFINITION',
        severity: 'warning',
        path: String(savedSection.formSectionUniqueId ?? ''),
        message: 'A saved section is no longer present in the current definition.',
      });
      continue;
    }

    const pages = savedSection.sectionLoopQuestionAnswerDetail ?? [];
    if (!pages.length) continue;
    const loopConfigured = isLoopSection(definition, section);
    if (pages.length > 1 && !loopConfigured) {
      diagnostics.push({
        code: 'RESTORE_REPEATED_SECTION_NOT_CONFIGURED',
        severity: 'error',
        path: section.id,
        message: 'The saved section contains multiple loop pages but has no active InsideForm SectionLoop expression.',
      });
      continue;
    }

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const backendLoopNumber = page.loopNumber ?? pageIndex + 1;
      if (!Number.isInteger(backendLoopNumber) || backendLoopNumber < 1) {
        diagnostics.push({
          code: 'RESTORE_LOOP_NUMBER_INVALID',
          severity: 'error',
          path: section.id + '.pages[' + pageIndex + '].loopNumber',
          message: 'Backend loop numbers must be positive one-based integers.',
        });
        break;
      }
      const iterationIndex = backendLoopNumber - 1;
      if (iterationIndex !== pageIndex) {
        diagnostics.push({
          code: 'RESTORE_LOOP_NUMBER_NOT_CONTIGUOUS',
          severity: 'error',
          path: section.id + '.pages[' + pageIndex + '].loopNumber',
          message: 'Saved loop pages must be contiguous and ordered from backend loop number 1.',
        });
        break;
      }

      if (loopConfigured && iterationIndex > 0) {
        const advanced = advanceSurveyLoop(definition, loopRuntime, answerState, section.id, true);
        if (!advanced.applied) {
          diagnostics.push(...advanced.diagnostics.map(toSurveyDiagnostic));
          break;
        }
        loopRuntime = advanced.runtime;
        answerState = advanced.answerState;
      }

      const answerInstanceId = loopConfigured && iterationIndex > 0
        ? loopRuntime.sections[section.id]?.iterations[iterationIndex]?.answerInstanceId
        : 'root';
      if (!answerInstanceId) {
        diagnostics.push({
          code: 'RESTORE_LOOP_INSTANCE_MISSING',
          severity: 'error',
          path: section.id + '#' + iterationIndex,
          message: 'The loop answer instance could not be created for the saved iteration.',
        });
        break;
      }

      const restored = restorePageQuestions(definition, section, page.sectionQuestionAnswerDetail ?? []);
      diagnostics.push(...restored.diagnostics);
      const hydrated = hydrateAnswerInstance(
        definition,
        answerState,
        answerInstanceId,
        restored.answers,
      );
      if (!hydrated.applied) {
        diagnostics.push(...hydrated.diagnostics.map((item) => ({
          code: item.code,
          severity: item.severity,
          path: item.path,
          message: item.message,
        })));
        break;
      }
      answerState = hydrated.state;

      if (loopConfigured) {
        // The original loader marks restored pages filled only for popup sections.
        loopRuntime = setSurveyLoopIterationFilled(
          loopRuntime, section.id, iterationIndex, section.isPopUp === true,
        );
      }
    }
  }

  return freezeResult(answerState, loopRuntime, temporary, diagnostics);
}

function restorePageQuestions(
  definition: SurveyDefinition,
  section: SurveySectionDefinition,
  savedQuestions: readonly GetFormQuestionAnswerDto[],
): {
  readonly answers: ReturnType<typeof restoreQuestionAnswer>['answer'][];
  readonly diagnostics: readonly SurveyRestoreDiagnostic[];
} {
  const answers: ReturnType<typeof restoreQuestionAnswer>['answer'][] = [];
  const diagnostics: SurveyRestoreDiagnostic[] = [];
  for (const saved of savedQuestions) {
    const question = definition.questions.find((item) =>
      item.sourceId === saved.uniqueId || item.uniqueIdPerForm === saved.uniqueId);
    if (!question) {
      diagnostics.push({
        code: 'RESTORE_QUESTION_NOT_IN_DEFINITION',
        severity: 'warning',
        path: section.id + '.' + String(saved.uniqueId ?? ''),
        message: 'A saved question is no longer present in the current definition.',
      });
      continue;
    }
    const restored = restoreQuestionAnswer(question, saved);
    answers.push(restored.answer);
    diagnostics.push(...restored.diagnostics.map(toSurveyDiagnostic));
    if (question.questionType === FormQuestionTypesEnum.RetailAudit) {
      diagnostics.push({
        code: 'RESTORE_RETAIL_AUDIT_DEFERRED',
        severity: 'warning',
        path: section.id + '.' + question.id,
        message: 'RetailAudit child-question reconstruction is not yet wired into section restore.',
      });
    }
  }
  return { answers, diagnostics };
}

function toSurveyDiagnostic(item: QuestionAnswerRestoreDiagnostic | {
  readonly code: string; readonly severity: 'warning' | 'error'; readonly path: string; readonly message: string;
}): SurveyRestoreDiagnostic {
  return {
    code: item.code,
    severity: item.severity,
    path: item.path,
    message: item.message,
  };
}

function freezeResult(
  answerState: AnswerStateSnapshot,
  loopRuntime: SurveyLoopRuntimeSnapshot,
  temporary: GetTempVoterForLoadDto | undefined,
  diagnostics: SurveyRestoreDiagnostic[],
): SurveyRestoreResult {
  for (const item of diagnostics) Object.freeze(item);
  const isValid = !diagnostics.some((item) => item.severity === 'error');
  return Object.freeze({
    answerState,
    loopRuntime,
    elapsedTime: temporary?.elapsedTime ?? 0,
    completionPercentage: temporary?.completePercentage,
    diagnostics: Object.freeze(diagnostics),
    isValid,
  });
}
