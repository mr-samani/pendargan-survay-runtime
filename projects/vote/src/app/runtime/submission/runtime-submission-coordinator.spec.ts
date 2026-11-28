import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CreateOrEditVoterAndDetailsOutputDto, CreateVoterWithDetailsDto, FormQuestionTypesEnum, FormSectionTypeEnum } from '@service-proxies/models';
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
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(() => of(Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'tracking-1' }), { success: true })));
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
    const response = Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'temporary-tracking' }), { success: true });
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

  it('runs the host readiness gate after metadata preparation and before network submission', async () => {
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(
      () => of(Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'must-not-send' }), { success: true })),
    );
    const order: string[] = [];
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(), metadata, {}, {
      prepareMetadata: async (value) => { order.push('prepare'); return value; },
      assertReadyForSubmission: () => { order.push('assert'); throw new Error('Uploads are still pending.'); },
    });
    expect(outcome).toMatchObject({ status: 'rejected', reason: 'Uploads are still pending.' });
    expect(order).toEqual(['prepare', 'assert']);
    expect(send).not.toHaveBeenCalled();
    expect(coordinator.isSubmitting).toBe(false);
  });

  it('rejects invalid sessions before any network request', async () => {
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(() => of(Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'must-not-submit' }), { success: true })));
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(false), metadata);
    expect(outcome.status).toBe('rejected');
    expect(send).not.toHaveBeenCalled();
  });

  it('prepares platform metadata before building and preserves partial-payment callback behavior', async () => {
    const partialDefinition: SurveyDefinition = {
      ...definition,
      questions: [
        { ...definition.questions[0], sortKey: 1 },
        {
          id: 'payment-q', source: { uniqueId: 'payment-question' },
          sourceId: 'payment-question', uniqueIdPerForm: 'payment-question-ref',
          formSectionUniqueId: 'section', questionType: FormQuestionTypesEnum.Payment,
          sortKey: 2, isActive: true, isRequired: true, settings: null, options: [],
        },
      ],
    };
    const baseSession = session();
    const answers = applyAnswerCommands(partialDefinition, createInitialAnswerState(partialDefinition), [{
      type: 'set-value', instanceId: 'root', questionId: 'question', value: 'canonical answer',
    }]).state;
    const partialSession: SurveyRuntimeSessionSnapshot = {
      ...baseSession,
      answers,
      loops: createSurveyLoopRuntime(partialDefinition),
      projection: {
        ...baseSession.projection,
        answerState: answers,
        visibility: {
          ...baseSession.projection.visibility,
          questions: [
            ...baseSession.projection.visibility.questions,
            { questionId: 'payment-q', isVisible: true, options: [] },
          ],
        },
        validation: {
          ...baseSession.projection.validation,
          answerRevision: answers.revision,
          questions: [
            { questionId: 'question', status: 'valid', issues: [] },
            { questionId: 'payment-q', status: 'invalid', issues: [] },
          ],
          isValid: false,
        },
      },
    };
    const send = vi.fn<(dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>>(() => of(Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'partial-tracking', partialIndex: 2 }), { success: true })));
    const onPartialSuccess = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(partialDefinition, partialSession, metadata, {}, {
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
      expect.objectContaining({ trackingCode: 'partial-tracking', partialIndex: 2, success: true }));
  });

  it('rejects ABP business failures returned with HTTP 200', async () => {
    const response = Object.assign(
      new CreateOrEditVoterAndDetailsOutputDto({ message: 'Quota exceeded' }),
      { success: false, error: { message: 'Quota exceeded' } },
    );
    const send = vi.fn(() => of(response));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(send);
    const outcome = await coordinator.submit(definition, session(), metadata, {}, { onSuccess, onError });
    expect(outcome.status).toBe('failed');
    expect(outcome).toMatchObject({ response, error: expect.objectContaining({ message: 'Quota exceeded' }) });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(coordinator.isSubmitting).toBe(false);
  });

  it('does not report a rejected temporary save as saved', async () => {
    const response = Object.assign(new CreateOrEditVoterAndDetailsOutputDto({
      message: 'Temporary save rejected',
    }), { success: false, error: { message: 'Temporary save rejected' } });
    const onTemporarySaved = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(() => of(response));
    const outcome = await coordinator.submit(
      definition, session(), { ...metadata, temporarySave: true }, {}, { onTemporarySaved },
    );
    expect(outcome.status).toBe('failed');
    expect(onTemporarySaved).not.toHaveBeenCalled();
  });

  it('prevents concurrent duplicate submissions and releases the lock after completion', async () => {
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
    resolveRequest(Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'done' }), { success: true }));
    expect((await pending).status).toBe('submitted');
    expect(coordinator.isSubmitting).toBe(false);
  });

  it('keeps a successful final-save outcome when the post-save UI callback throws', async () => {
    const response = Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'saved-final' }), { success: true });
    const callbackError = new Error('navigation failed after save');
    const onSuccess = vi.fn(() => { throw callbackError; });
    const onCallbackError = vi.fn();
    const onError = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(() => of(response));

    const outcome = await coordinator.submit(definition, session(), metadata, {}, {
      onSuccess, onCallbackError, onError,
    });

    expect(outcome.status).toBe('submitted');
    expect(outcome).toMatchObject({ response });
    expect(onSuccess).toHaveBeenCalledWith(response);
    expect(onCallbackError).toHaveBeenCalledWith(callbackError);
    expect(onError).not.toHaveBeenCalled();
    expect(coordinator.isSubmitting).toBe(false);
  });

  it('keeps a successful temporary-save outcome when its follow-up callback throws', async () => {
    const response = Object.assign(new CreateOrEditVoterAndDetailsOutputDto({ trackingCode: 'saved-temp' }), { success: true });
    const callbackError = new Error('temporary-save dialog failed');
    const onTemporarySaved = vi.fn(() => { throw callbackError; });
    const onCallbackError = vi.fn();
    const coordinator = new RuntimeSubmissionCoordinator(() => of(response));

    const outcome = await coordinator.submit(
      definition, session(), { ...metadata, temporarySave: true }, {}, {
        onTemporarySaved, onCallbackError,
      },
    );

    expect(outcome.status).toBe('temporary-saved');
    expect(outcome).toMatchObject({ response });
    expect(onTemporarySaved).toHaveBeenCalledWith(response);
    expect(onCallbackError).toHaveBeenCalledWith(callbackError);
  });

  it('does not let a throwing error-reporting callback hide an ABP business failure', async () => {
    const response = Object.assign(
      new CreateOrEditVoterAndDetailsOutputDto({ message: 'Quota exceeded' }),
      { success: false, error: { message: 'Quota exceeded' } },
    );
    const callbackError = new Error('toast renderer failed');
    const onError = vi.fn(() => { throw callbackError; });
    const onCallbackError = vi.fn(() => { throw new Error('logger failed'); });
    const coordinator = new RuntimeSubmissionCoordinator(() => of(response));

    const outcome = await coordinator.submit(definition, session(), metadata, {}, {
      onError, onCallbackError,
    });

    expect(outcome.status).toBe('failed');
    expect(outcome).toMatchObject({ response, error: expect.objectContaining({ message: 'Quota exceeded' }) });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onCallbackError).toHaveBeenCalledWith(callbackError);
    expect(coordinator.isSubmitting).toBe(false);
  });

});
