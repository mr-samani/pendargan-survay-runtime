import { describe, expect, it } from 'vitest';
import {
  AllocationTypeEnum,
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormQuestionTypesEnum,
  FormExpressionTypeEnum,
  FormSectionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState, applyAnswerCommands } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime, advanceSurveyLoop } from '../flow/loop-runtime';
import type { SurveyRuntimeSessionSnapshot } from '../session/runtime-session';
import { buildSurveyRuntimeSubmission, validatePaymentPartialSave } from './survey-runtime-submission';

function definition(): SurveyDefinition {
  return {
    id: 'runtime-submit',
    sections: [
      { id: 'ordinary', source: {}, sourceId: 'ordinary-db', uniqueIdPerForm: 'ordinary-ref', type: FormSectionTypeEnum.Normal },
      { id: 'repeat', source: {}, sourceId: 'repeat-db', uniqueIdPerForm: 'repeat-ref', type: FormSectionTypeEnum.Normal },
    ],
    questions: [
      { id: 'plain-q', source: { uniqueId: 'plain-db' }, sourceId: 'plain-db', uniqueIdPerForm: 'plain-ref',
        questionType: FormQuestionTypesEnum.ShortText, formSectionUniqueId: 'ordinary-ref',
        isActive: true, isRequired: false, options: [], settings: null },
      { id: 'loop-q', source: { uniqueId: 'loop-db' }, sourceId: 'loop-db', uniqueIdPerForm: 'loop-ref',
        questionType: FormQuestionTypesEnum.Numeric, formSectionUniqueId: 'repeat-ref',
        isActive: true, isRequired: false, options: [], settings: null },
    ],
    expressions: [{
      id: 'loop-exp', source: {}, expressionText: 'true',
      targetType: ExpressionTargetsEnum.SectionLoop, targetKey: 'repeat-ref',
      formExpressionType: FormExpressionTypeEnum.InsideForm, isActive: true,
    }],
    globalVariables: [],
  };
}

function session(def: SurveyDefinition): SurveyRuntimeSessionSnapshot {
  const root = applyAnswerCommands(def, createInitialAnswerState(def), [
    { type: 'set-value', instanceId: 'root', questionId: 'plain-q', value: 'root answer' },
    { type: 'set-value', instanceId: 'root', questionId: 'loop-q', value: 'first loop' },
  ]).state;
  const loops = createSurveyLoopRuntime(def);
  const stopped = advanceSurveyLoop(def, loops, root, 'repeat', false);
  const answers = applyAnswerCommands(def, stopped.answerState, [
    { type: 'set-value', instanceId: 'root', questionId: 'plain-q', value: 'root answer' },
  ]).state;
  return {
    surveyId: def.id, revision: 1, answers, loops: stopped.runtime,
    currentPageId: 'page',
    globalVariableValuesByInstance: {},
    legacyRuntimeStateByInstance: {},
    projection: {
      answerState: answers,
      evaluation: {
        surveyId: def.id, formulaResults: [], globalVariableValues: [], proposedActions: [],
        diagnostics: [], isValid: true,
      },
      visibility: {
        surveyId: def.id,
        questions: [
          { questionId: 'plain-q', isVisible: true, options: [] },
          { questionId: 'loop-q', isVisible: true, options: [] },
        ],
        sections: [], unhandledActions: [], diagnostics: [], isValid: true,
      },
      flow: {
        surveyId: def.id, mode: 'section',
        pages: [{ id: 'page', kind: 'section', sectionId: 'repeat', questionIds: ['loop-q'], answerInstanceId: 'root', loopIterationIndex: 0, backendLoopNumber: 1 }],
        visibleQuestionIds: ['plain-q', 'loop-q'], visibleSectionIds: ['ordinary', 'repeat'],
        unresolvedQuestionIds: [], unresolvedSectionIds: [], diagnostics: [], isReady: true, isValid: true,
      },
      validation: {
        surveyId: def.id, instanceId: 'root', answerRevision: answers.revision,
        questions: [], issues: [], isValid: true,
      },
    },
  };
}

const metadata = {
  formGuid: 'form-guid', elapsedTime: 12, temporarySave: false,
};

describe('buildSurveyRuntimeSubmission', () => {
  it('serializes ordinary root sections and loop sections into one payload', () => {
    const def = definition();
    const current = session(def);
    const result = buildSurveyRuntimeSubmission(def, current, metadata);
    expect(result.projection.isValid).toBe(true);
    expect(result.projection.formSections).toHaveLength(2);
    expect(result.projection.formSections[0].repeatSections?.[0].voterAnswerDetails?.[0].answerDescription)
      .toBe('root answer');
    expect(result.projection.formSections[1].repeatSections?.[0].voterAnswerDetails?.[0].answerDescription)
      .toBe('first loop');
    expect(result.payload.isValid).toBe(true);
    expect(result.payload.dto?.guid).toBe('form-guid');
  });

  it('resolves all supported section-reference aliases without duplicating questions', () => {
    const base = definition();
    for (const sectionReference of ['ordinary-ref', 'ordinary-db', 'ordinary']) {
      const def: SurveyDefinition = {
        ...base,
        questions: base.questions.map((question) =>
          question.id === 'plain-q'
            ? { ...question, formSectionUniqueId: sectionReference }
            : question,
        ),
      };
      const result = buildSurveyRuntimeSubmission(def, session(def), metadata);
      expect(result.projection.formSections[0].repeatSections?.[0].voterAnswerDetails?.[0].answerDescription)
        .toBe('root answer');
      expect(result.projection.formSections).toHaveLength(2);
    }
  });

  it('rejects a session with invalid validation instead of producing a partial DTO', () => {
    const def = definition();
    const current = session(def);
    const invalid = {
      ...current,
      projection: { ...current.projection, validation: { ...current.projection.validation, isValid: false } },
    };
    const result = buildSurveyRuntimeSubmission(def, invalid, metadata);
    expect(result.projection.isValid).toBe(false);
    expect(result.projection.formSections).toEqual([]);
    expect(result.payload.isValid).toBe(false);
  });

  it('allows incomplete answers for temporary saves while preserving the canonical answers', () => {
    const def = definition();
    const current = session(def);
    const invalid = {
      ...current,
      projection: { ...current.projection, validation: { ...current.projection.validation, isValid: false } },
    };
    const result = buildSurveyRuntimeSubmission(def, invalid, {
      ...metadata,
      temporarySave: true,
    });

    expect(result.projection.isValid).toBe(true);
    expect(result.projection.formSections).toHaveLength(2);
    expect(result.payload.isValid).toBe(true);
    expect(result.payload.dto?.temporarySave).toBe(true);
  });

  it('excludes hidden questions and options using the live visibility projection', () => {
    const def = definition();
    const current = session(def);
    const hidden = {
      ...current,
      projection: {
        ...current.projection,
        visibility: {
          ...current.projection.visibility,
          questions: [
            { questionId: 'plain-q', isVisible: false, options: [] },
            { questionId: 'loop-q', isVisible: true, options: [] },
          ],
        },
      },
    };
    const result = buildSurveyRuntimeSubmission(def, hidden, metadata);
    expect(result.projection.formSections).toHaveLength(1);
    expect(result.projection.formSections[0].repeatSections?.[0].voterAnswerDetails?.[0].formQuestionUniqueId)
      .toBe('loop-db');
  });
  it('expands each completed RetailAudit product into a synthetic DynamicAnswer loop page with child answers', () => {
    const base = definition();
    const retailQuestion = {
      id: 'retail-q', source: { uniqueId: 'retail-db', dynamicDataUniqueId: 'products' },
      sourceId: 'retail-db', uniqueIdPerForm: 'retail-ref',
      questionType: FormQuestionTypesEnum.RetailAudit, formSectionUniqueId: 'retail-section-ref',
      isActive: true, isRequired: false, options: [], settings: null,
    } as const;
    const childQuestion = {
      id: 'retail-child', source: { uniqueId: 'retail-child-db' },
      sourceId: 'retail-child-db', uniqueIdPerForm: 'retail-child-ref',
      questionType: FormQuestionTypesEnum.Numeric, formSectionUniqueId: 'retail-section-ref',
      parentUniqueId: 'retail-db', isActive: true, isRequired: true, options: [], settings: null,
    } as const;
    const def: SurveyDefinition = {
      ...base,
      sections: [...base.sections, {
        id: 'retail-section', source: {}, sourceId: 'retail-section-db',
        uniqueIdPerForm: 'retail-section-ref', type: FormSectionTypeEnum.Normal,
      }],
      questions: [...base.questions, retailQuestion, childQuestion],
    };
    const current = session(def);
    const answers = applyAnswerCommands(def, current.answers, [{
      type: 'set-value',
      instanceId: 'root',
      questionId: 'retail-q',
      value: [
        {
          identificationCode: 101, answerTitle: 'Product A', formValid: true,
          retaliVariables: { batch: 'A' },
          questionChilds: [{
            questionId: 'retail-child-db', questionType: FormQuestionTypesEnum.Numeric,
            answer: '12', selectedOptionIds: [], isRequired: true, isActive: true,
            dontShow: false, endForm: false, questionChilds: [],
          }],
        },
        { identificationCode: 102, answerTitle: 'Product B', formValid: false, retaliVariables: { batch: 'B' }, questionChilds: [] },
        { identificationCode: 103, answerTitle: 'Product C', retaliVariables: { batch: 'C' }, questionChilds: [] },
      ],
    }]).state;
    const populated: SurveyRuntimeSessionSnapshot = {
      ...current,
      answers,
      projection: {
        ...current.projection,
        answerState: answers,
        visibility: {
          ...current.projection.visibility,
          questions: [
            ...current.projection.visibility.questions,
            { questionId: 'retail-q', isVisible: true, options: [] },
            { questionId: 'retail-child', isVisible: true, options: [] },
          ],
        },
      },
    };

    const result = buildSurveyRuntimeSubmission(def, populated, metadata);
    const retailSection = result.projection.formSections[2];
    expect(result.projection.isValid).toBe(true);
    expect(retailSection.repeatSections).toHaveLength(1);
    expect(retailSection.repeatSections?.[0].voterAnswerDetails).toMatchObject([
      {
        formQuestionUniqueId: 'retail-db',
        dynamicDataRecordId: 101,
        answerTitle: 'Product A',
      },
      {
        formQuestionUniqueId: 'retail-child-db',
        dynamicDataRecordId: 101,
        answerDescription: '12',
      },
    ]);
    expect(retailSection.repeatSections?.[0].variablesRepeatedSectionValue).toEqual({ batch: 'A' });
    expect(result.projection.variablesLastValue).toEqual({ batch: 'A' });

    const payload = JSON.parse(JSON.stringify(result.payload.dto));
    expect(payload.formSections[2]).toEqual({
      repeatSections: [{
        voterAnswerDetails: [
          {
            answerTitle: 'Product A', answerDescription: '',
            formQuestionUniqueId: 'retail-db', questionOptionUniqueId: '',
            files: [], dynamicDataRecordId: 101, validationGuid: '',
          },
          {
            answerTitle: '', answerDescription: '12',
            formQuestionUniqueId: 'retail-child-db', questionOptionUniqueId: '',
            files: [], dynamicDataRecordId: 101, validationGuid: '',
          },
        ],
        variablesRepeatedSectionValue: { batch: 'A' },
      }],
    });
  });

  it('keeps explicitly attempted incomplete RetailAudit rows only for temporary saves', () => {
    const base = definition();
    const retailQuestion = {
      id: 'retail-q', source: { uniqueId: 'retail-db' }, sourceId: 'retail-db',
      uniqueIdPerForm: 'retail-ref', questionType: FormQuestionTypesEnum.RetailAudit,
      formSectionUniqueId: 'retail-section-ref', isActive: true, isRequired: false,
      options: [], settings: null,
    } as const;
    const def: SurveyDefinition = {
      ...base,
      sections: [...base.sections, {
        id: 'retail-section', source: {}, sourceId: 'retail-section-db',
        uniqueIdPerForm: 'retail-section-ref', type: FormSectionTypeEnum.Normal,
      }],
      questions: [...base.questions, retailQuestion],
    };
    const current = session(def);
    const answers = applyAnswerCommands(def, current.answers, [{
      type: 'set-value', instanceId: 'root', questionId: 'retail-q',
      value: [
        { identificationCode: 101, answerTitle: 'Completed', formValid: true, questionChilds: [] },
        { identificationCode: 102, answerTitle: 'Attempted', formValid: false, questionChilds: [] },
        { identificationCode: 103, answerTitle: 'Not opened', questionChilds: [] },
      ],
    }]).state;
    const populated: SurveyRuntimeSessionSnapshot = {
      ...current,
      answers,
      projection: {
        ...current.projection,
        answerState: answers,
        visibility: {
          ...current.projection.visibility,
          questions: [...current.projection.visibility.questions, { questionId: 'retail-q', isVisible: true, options: [] }],
        },
      },
    };

    const finalSave = buildSurveyRuntimeSubmission(def, populated, metadata);
    const temporarySave = buildSurveyRuntimeSubmission(def, populated, { ...metadata, temporarySave: true });
    expect(finalSave.projection.formSections[2].repeatSections).toHaveLength(1);
    expect(temporarySave.projection.formSections[2].repeatSections).toHaveLength(2);
    expect(temporarySave.projection.formSections[2].repeatSections?.map((item) =>
      item.voterAnswerDetails?.[0].answerTitle,
    )).toEqual(['Completed', 'Attempted']);
  });


  it('allows partial payment only when every preceding question is explicitly valid', () => {
    const base = definition();
    const payment: SurveyDefinition['questions'][number] = {
      id: 'payment-q', source: { uniqueId: 'payment-db' }, sourceId: 'payment-db',
      uniqueIdPerForm: 'payment-ref', questionType: FormQuestionTypesEnum.Payment,
      formSectionUniqueId: 'ordinary-ref', sortKey: 30,
      isActive: true, isRequired: true, options: [], settings: null,
    } as const;
    const def: SurveyDefinition = {
      ...base,
      questions: [...base.questions.map((question, index) => ({ ...question, sortKey: (index + 1) * 10 })), payment],
    };
    const current = session(def);
    const validSession: SurveyRuntimeSessionSnapshot = {
      ...current,
      projection: {
        ...current.projection,
        validation: {
          ...current.projection.validation,
          questions: [
            { questionId: 'plain-q', status: 'valid', issues: [] },
            { questionId: 'loop-q', status: 'valid', issues: [] },
          ],
        },
      },
    };
    expect(validatePaymentPartialSave(def, validSession, 'payment-ref')).toMatchObject({
      allowed: true, paymentQuestionId: 'payment-q',
      invalidPreviousQuestionIds: [], unknownPreviousQuestionIds: [],
    });

    const invalidSession: SurveyRuntimeSessionSnapshot = {
      ...validSession,
      projection: {
        ...validSession.projection,
        validation: {
          ...validSession.projection.validation,
          questions: [
            { questionId: 'plain-q', status: 'valid', issues: [] },
            { questionId: 'loop-q', status: 'invalid', issues: [] },
          ],
        },
      },
    };
    expect(validatePaymentPartialSave(def, invalidSession, 'payment-ref')).toMatchObject({
      allowed: false, invalidPreviousQuestionIds: ['loop-q'],
    });
  });

  it('fails closed when a preceding question has no validation result', () => {
    const base = definition();
    const payment = {
      id: 'payment-q', source: { uniqueId: 'payment-db' }, sourceId: 'payment-db',
      uniqueIdPerForm: 'payment-ref', questionType: FormQuestionTypesEnum.Payment,
      formSectionUniqueId: 'ordinary-ref', sortKey: 30,
      isActive: true, isRequired: true, options: [], settings: null,
    } as const;
    const def: SurveyDefinition = {
      ...base,
      questions: base.questions.map((question, index) => ({ ...question, sortKey: (index + 1) * 10 }))
        .concat(payment),
    };
    const current = session(def);
    const result = validatePaymentPartialSave(def, current, 'payment-ref');
    expect(result.allowed).toBe(false);
    expect(result.unknownPreviousQuestionIds).toEqual(['plain-q', 'loop-q']);
  });

  it('rejects ambiguous payment question references instead of choosing the first match', () => {
    const base = definition();
    const payment = {
      id: 'payment-q', source: { uniqueId: 'shared-ref' }, sourceId: 'shared-ref',
      uniqueIdPerForm: 'payment-ref', questionType: FormQuestionTypesEnum.Payment,
      formSectionUniqueId: 'ordinary-ref', sortKey: 30,
      isActive: true, isRequired: true, options: [], settings: null,
    } as const;
    const collision: SurveyDefinition['questions'][number] = {
      id: 'other-q', source: { uniqueId: 'shared-ref' }, sourceId: 'shared-ref',
      uniqueIdPerForm: 'other-ref', questionType: FormQuestionTypesEnum.ShortText,
      formSectionUniqueId: 'ordinary-ref', sortKey: 40,
      isActive: true, isRequired: false, options: [], settings: null,
    } as const;
    const def: SurveyDefinition = { ...base, questions: [...base.questions, payment, collision] };
    const result = validatePaymentPartialSave(def, session(def), 'shared-ref');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('ambiguous');
  });


  it('matches the complete final CreateVoterWithDetailsDto golden payload', () => {
    const def = definition();
    const result = buildSurveyRuntimeSubmission(def, session(def), {
      ...metadata,
      latitude: 35.7,
      longitude: 51.4,
      gpsAccuracy: 8,
      regionUniqueId: 'region-child',
      expressionActions: ExpressionActionsEnum.SetValid,
      completionPercentage: 75,
      pollRoute: 'route-token',
      voiceRecordFileIdUnique: [{ fileUniqueId: 'recorded-audio-id', order: 0 }],
      allocationType: AllocationTypeEnum.FieldAllocation,
      acceptPreviousData: true,
    });
    const payload = JSON.parse(JSON.stringify(result.payload.dto));
    const answer = (questionId: string, description: string) => ({
      answerTitle: '', answerDescription: description, formQuestionUniqueId: questionId,
      questionOptionUniqueId: '', files: [], validationGuid: '',
    });
    expect(payload).toEqual({
      guid: 'form-guid',
      voterDetail: {
        latitude: 35.7, longitude: 51.4, gpsAccuracy: 8, guid: 'form-guid',
        elapsedTime: 12, regionUniqueId: 'region-child',
        voiceRecordFileIdUnique: [{ fileUniqueId: 'recorded-audio-id', order: 0 }],
        expressionActions: ExpressionActionsEnum.SetValid, completionPercentage: 75,
        pollRoute: 'route-token',
      },
      formSections: [
        { repeatSections: [{
          voterAnswerDetails: [answer('plain-db', 'root answer')],
          variablesRepeatedSectionValue: {},
        }] },
        { repeatSections: [{
          voterAnswerDetails: [answer('loop-db', 'first loop')],
          variablesRepeatedSectionValue: {},
        }] },
      ],
      variablesLastValue: {},
      allocationType: AllocationTypeEnum.FieldAllocation,
      temporarySave: false,
      acceptPreviousData: true,
    });
  });

  it('matches the complete temporary-save golden payload while retaining incomplete answers', () => {
    const def = definition();
    const current = session(def);
    const answers = applyAnswerCommands(def, current.answers, [{
      type: 'set-value', instanceId: 'root', questionId: 'plain-q', value: null,
    }]).state;
    const incomplete: SurveyRuntimeSessionSnapshot = {
      ...current,
      answers,
      projection: {
        ...current.projection,
        answerState: answers,
        validation: {
          ...current.projection.validation,
          questions: [
            { questionId: 'plain-q', status: 'invalid', issues: [] },
            { questionId: 'loop-q', status: 'valid', issues: [] },
          ],
          isValid: false,
        },
      },
    };
    const result = buildSurveyRuntimeSubmission(def, incomplete, {
      ...metadata, temporarySave: true,
    });
    const payload = JSON.parse(JSON.stringify(result.payload.dto));
    const answer = (questionId: string, description: string) => ({
      answerTitle: '', answerDescription: description, formQuestionUniqueId: questionId,
      questionOptionUniqueId: '', files: [], validationGuid: '',
    });
    expect(payload).toEqual({
      guid: 'form-guid',
      voterDetail: { guid: 'form-guid', elapsedTime: 12, regionUniqueId: '', voiceRecordFileIdUnique: [] },
      formSections: [
        { repeatSections: [{
          voterAnswerDetails: [answer('plain-db', '')],
          variablesRepeatedSectionValue: {},
        }] },
        { repeatSections: [{
          voterAnswerDetails: [answer('loop-db', 'first loop')],
          variablesRepeatedSectionValue: {},
        }] },
      ],
      variablesLastValue: {},
      temporarySave: true,
    });
  });

  it('matches the complete partial-payment golden payload after validating every predecessor', () => {
    const base = definition();
    const payment: SurveyDefinition['questions'][number] = {
      id: 'payment-q', source: { uniqueId: 'payment-db' }, sourceId: 'payment-db',
      uniqueIdPerForm: 'payment-ref', questionType: FormQuestionTypesEnum.Payment,
      formSectionUniqueId: 'ordinary-ref', sortKey: 30, isActive: true, isRequired: true,
      options: [], settings: { amount: 125000 },
    };
    const def: SurveyDefinition = {
      ...base,
      questions: base.questions.map((question, index) => ({
        ...question, sortKey: (index + 1) * 10,
      })).concat(payment),
    };
    const current = session(def);
    const validPredecessors: SurveyRuntimeSessionSnapshot = {
      ...current,
      projection: {
        ...current.projection,
        visibility: {
          ...current.projection.visibility,
          questions: [
            ...current.projection.visibility.questions,
            { questionId: 'payment-q', isVisible: true, options: [] },
          ],
        },
        validation: {
          ...current.projection.validation,
          questions: [
            { questionId: 'plain-q', status: 'valid', issues: [] },
            { questionId: 'loop-q', status: 'valid', issues: [] },
          ],
          isValid: false,
        },
      },
    };
    const result = buildSurveyRuntimeSubmission(def, validPredecessors, {
      ...metadata,
      isPartial: true,
      partialPayment: {
        partialRegisterFormQuestionUniqueId: 'payment-ref',
        tenantPaymentGatewayId: 'tenant-gateway-id',
      },
    });
    const payload = JSON.parse(JSON.stringify(result.payload.dto));
    const answer = (questionId: string, description: string, title = '') => ({
      answerTitle: title, answerDescription: description, formQuestionUniqueId: questionId,
      questionOptionUniqueId: '', files: [], validationGuid: '',
    });
    expect(payload).toEqual({
      guid: 'form-guid',
      voterDetail: { guid: 'form-guid', elapsedTime: 12, regionUniqueId: '', voiceRecordFileIdUnique: [] },
      formSections: [
        { repeatSections: [{
          voterAnswerDetails: [
            answer('plain-db', 'root answer'),
            answer('payment-db', '', '125000'),
          ],
          variablesRepeatedSectionValue: {},
        }] },
        { repeatSections: [{
          voterAnswerDetails: [answer('loop-db', 'first loop')],
          variablesRepeatedSectionValue: {},
        }] },
      ],
      variablesLastValue: {},
      temporarySave: false,
      partialRegisterForPayment: {
        partialRegisterFormQuestionUniqueId: 'payment-ref',
        tenantPaymentGatewayId: 'tenant-gateway-id',
      },
    });
  });

});