import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CreateOrEditVoterAndDetailsOutputDto, CreateVoterWithDetailsDto, FormSectionTypeEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { applyAnswerCommands, createInitialAnswerState } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime } from '../flow/loop-runtime';
import type { SurveyRuntimeSessionSnapshot } from '../session/runtime-session';
import { RuntimeSubmissionCoordinator } from './runtime-submission-coordinator';

const definition: SurveyDefinition = {
  id: 'submit-coordinator',
  sections: [{ id: 'section', source: {}, uniqueIdPerForm: 'section-ref', type: FormSectionTypeEnum.Normal }],
  questions: [{
    id: 'question', source: { uniqueId: 'question-db' }, uniqueIdPerForm: 'question-ref', sourceId: 'question-db',
    formSectionUniqueId: 'section-ref', questionType: FormQuestionTypesEnum.ShortText,
    isActive: true, isRequired: false, settings: null, options: [],
  }],
  expressions: [], globalVariables: [],
};

function session(valid = true): SurveyRuntimeSessionSnapshot {
  const initial = createInitialAnswerState(definition);
  const answers = applyAnswerCommands(definition, initial, [{
    type: 'set-value', instanceId: 'root', questionId: 'question', value: 'canonical answer',
  }]).state;
  return {
    surveyId: definition.id,
    revision: 0,
    answers,
    loops: createSurveyLoopRuntime(definition),
    currentPageId: 'page',
    globalVariableValuesByInstance: {},
    legacyRuntimeStateByInstance: {},
    projection: {
      answerState: answers,
      evaluation: {
        surveyId: definition.id, formulaResults: [], globalVariableValues: [],
        proposedActions: [], diagnostics: [], isValid: true,
      },
      visibility: {
        surveyId: definition.id,
        questions: [{ questionId: 'question', isVisible: true, options: [] }],
        sections: [{ sectionId: 'section', isVisible: true, questionIds: ['question'] }],
        unhandledActions: [], diagnostics: [], isValid: true,
      },
      flow: {
        surveyId: definition.id, mode: 'section',
        pages: [{ id: 'page', kind: 'section', sectionId: 'section', questionIds: ['question'], answerInstanceId: 'root' }],
        visibleQuestionIds: ['question'], visibleSectionIds: ['section'],
        unresolvedQuestionIds: [], unresolvedSectionIds: [], diagnostics: [], isReady: true, isValid: true,
      },
      validation: {
        surveyId: definition.id, instanceId: 'root', answerRevision: answers.revision,
        questions: [{ questionId: 'question', status: valid ? 'valid' : 'invalid', issues: [] }],
        issues: [], isValid: valid,
      },
    },
  };
}

const metadata = { formGuid: 'form-guid', elapsedTime: 30, temporarySave: false };

describe('RuntimeSubmissionCoordinator', () => {
  it('builds the canonical DTO and sends it through the generated API adapter', async () => {
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(() => of(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'tracking-1' })));
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(), metadata);
    expect(outcome.status).toBe('submitted');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({
      guid: 'form-guid', temporarySave: false,
      formSections: [{ repeatSections: [{ voterAnswerDetails: expect.any(Array) }] }],
    });
    expect(coordinator.isSubmitting).toBe(false);
  });

  it('uses the same API for temporary save and reports the dedicated post-save outcome', async () => {
    const response = new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'temporary-tracking' });
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(
      () => of(response),
    );
    const onTemporarySaved = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(), {
      ...metadata, temporarySave: true,
    }, {}, { onTemporarySaved });
    expect(outcome.status).toBe('temporary-saved');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].temporarySave).toBe(true);
    expect(onTemporarySaved).toHaveBeenCalledWith(response);
  });

  it('rejects invalid sessions before any network request', async () => {
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(() => of(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'must-not-submit' })));
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(false), metadata);
    expect(outcome.status).toBe('rejected');
    expect(send).not.toHaveBeenCalled();
  });

  it('prepares platform metadata before building and preserves partial-payment callback behavior', async () => {
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(() => of(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'partial-tracking', partialIndex: 2 })));
    const onPartialSuccess = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(), metadata, {}, {
      prepareMetadata: async (value) => ({
        ...value,
        latitude: 35.7,
        voiceRecordFileIdUnique: [{ fileUniqueId: 'voice-id', order: 0 }],
        isPartial: true,
        partialPayment: {
          partialRegisterFormQuestionUniqueId: 'payment-question',
          tenantPaymentGatewayId: 'gateway',
        },
      }),
      onPartialSuccess,
    });
    expect(outcome.status).toBe('submitted');
    expect(send.mock.calls[0]![0].voterDetail?.latitude).toBe(35.7);
    expect(onPartialSuccess).toHaveBeenCalledWith('payment-question',
      new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'partial-tracking', partialIndex: 2 }));
  });

  it('prevents concurrent duplicate submissions and releases the lock after failure', async () => {
    let resolveRequest!: (value: CreateOrEditVoterAndDetailsOutputDto) => void;
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(
      () => new Observable<CreateOrEditVoterAndDetailsOutputDto>((subscriber) => {
        resolveRequest = (value) => { subscriber.next(value); subscriber.complete(); };
      }),
    );
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const pending = coordinator.submit(definition, session(), metadata);
    expect(coordinator.isSubmitting).toBe(true);
    const duplicate = await coordinator.submit(definition, session(), metadata);
    expect(duplicate.status).toBe('rejected');
    expect(send).toHaveBeenCalledTimes(1);
    resolveRequest(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'done' }));
    expect((await pending).status).toBe('submitted');
    expect(coordinator.isSubmitting).toBe(false);
  });
});
