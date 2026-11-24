import {
  AllocationTypeEnum,
  ExpressionActionsEnum,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { LoopSubmissionProjection } from '../flow/loop-submission-serializer';
import { buildCreateVoterWithDetailsDto } from './submission-payload-builder';

function answers(overrides: Partial<LoopSubmissionProjection> = {}): LoopSubmissionProjection {
  return {
    formSections: [],
    variablesLastValue: { region: 'north' },
    diagnostics: [],
    isValid: true,
    ...overrides,
  };
}
const metadata = {
  formGuid: 'form-guid',
  elapsedTime: 120,
  latitude: 35.7,
  longitude: 51.4,
  gpsAccuracy: 8,
  regionUniqueId: 'region-child',
  expressionActions: ExpressionActionsEnum.SetValid,
  completionPercentage: 75,
  pollRoute: 'route-token',
  voiceRecordFileIdUnique: [{ fileUniqueId: 'recorded-audio-id', order: 0 }],
  allocationType: AllocationTypeEnum.FieldAllocation,
  temporarySave: false,
  acceptPreviousData: true,
};

describe('buildCreateVoterWithDetailsDto', () => {
  it('assembles the generated DTO with duplicated GUID and voter metadata', () => {
    const result = buildCreateVoterWithDetailsDto(metadata, answers());
    expect(result.isValid).toBe(true);
    expect(result.dto).toBeDefined();
    const json = JSON.parse(JSON.stringify(result.dto));
    expect(json).toMatchObject({
      guid: 'form-guid',
      voterDetail: {
        guid: 'form-guid',
        elapsedTime: 120,
        latitude: 35.7,
        longitude: 51.4,
        gpsAccuracy: 8,
        regionUniqueId: 'region-child',
        expressionActions: ExpressionActionsEnum.Confirm,
        completionPercentage: 75,
        pollRoute: 'route-token',
        voiceRecordFileIdUnique: [{ fileUniqueId: 'recorded-audio-id', order: 0 }],
      },
      formSections: [],
      variablesLastValue: { region: 'north' },
      allocationType: AllocationTypeEnum.Normal,
      temporarySave: false,
      acceptPreviousData: true,
    });
    expect(json.partialRegisterForPayment).toBeUndefined();
  });

  it('omits zero GPS values exactly as the legacy client did', () => {
    const result = buildCreateVoterWithDetailsDto({
      ...metadata, latitude: 0, longitude: 0, gpsAccuracy: 0, regionUniqueId: '',
    }, answers());
    expect(result.dto?.voterDetail).toMatchObject({
      latitude: undefined, longitude: undefined, gpsAccuracy: undefined, regionUniqueId: '',
    });
  });

  it('includes partial payment registration only for the partial-payment flow', () => {
    const result = buildCreateVoterWithDetailsDto({
      ...metadata,
      isPartial: true,
      partialPayment: {
        partialRegisterFormQuestionUniqueId: 'payment-question',
        tenantPaymentGatewayId: 'gateway-id',
      },
    }, answers());
    expect(result.dto?.partialRegisterForPayment).toMatchObject({
      partialRegisterFormQuestionUniqueId: 'payment-question',
      tenantPaymentGatewayId: 'gateway-id',
    });
  });

  it('rejects partial payment without both required IDs', () => {
    const result = buildCreateVoterWithDetailsDto({
      ...metadata, isPartial: true,
      partialPayment: { partialRegisterFormQuestionUniqueId: '', tenantPaymentGatewayId: '' },
    }, answers());
    expect(result.isValid).toBe(false);
    expect(result.dto).toBeUndefined();
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'SUBMISSION_PARTIAL_QUESTION_ID_REQUIRED',
      'SUBMISSION_PAYMENT_GATEWAY_ID_REQUIRED',
    ]);
  });

  it('does not build a DTO when the answer projection is invalid', () => {
    const result = buildCreateVoterWithDetailsDto(metadata, answers({ isValid: false }));
    expect(result.isValid).toBe(false);
    expect(result.dto).toBeUndefined();
    expect(result.diagnostics[0].code).toBe('SUBMISSION_ANSWER_PROJECTION_INVALID');
  });
});
