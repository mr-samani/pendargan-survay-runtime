import {
  AllocationTypeEnum,
  CreateVoterDto,
  CreateVoterWithDetailsDto,
  ExpressionActionsEnum,
  FileVoterAnswerDetailsDto,
  PartialRegisterForPaymentDto,
} from '@service-proxies/models';
import type { LoopSubmissionProjection } from '../flow/loop-submission-serializer';

export interface PartialPaymentRegistrationInput {
  readonly partialRegisterFormQuestionUniqueId: string;
  readonly tenantPaymentGatewayId: string;
}

export interface SurveySubmissionMetadata {
  readonly formGuid: string;
  readonly elapsedTime: number;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly gpsAccuracy?: number | null;
  readonly regionUniqueId?: string | null;
  readonly expressionActions?: ExpressionActionsEnum;
  readonly voiceRecordFileIdUnique?: readonly { readonly fileUniqueId?: string; readonly order?: number }[];
  readonly completionPercentage?: number;
  readonly pollRoute?: string | null;
  readonly allocationType?: AllocationTypeEnum;
  readonly temporarySave: boolean;
  readonly acceptPreviousData?: boolean | null;
  readonly isPartial?: boolean;
  readonly partialPayment?: PartialPaymentRegistrationInput;
}

export interface SubmissionPayloadDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
export interface SubmissionPayloadBuildResult {
  readonly dto?: CreateVoterWithDetailsDto;
  readonly diagnostics: readonly SubmissionPayloadDiagnostic[];
  readonly isValid: boolean;
}

/**
 * Builds the top-level generated API DTO from already-resolved submission data.
 * Network lookups (poll route, GPS, timer, expression action) remain the caller's job.
 */
export function buildCreateVoterWithDetailsDto(
  metadata: SurveySubmissionMetadata,
  answers: LoopSubmissionProjection,
): SubmissionPayloadBuildResult {
  const diagnostics: SubmissionPayloadDiagnostic[] = [];
  if (!metadata.formGuid.trim()) {
    diagnostics.push({
      code: 'SUBMISSION_FORM_GUID_REQUIRED',
      path: 'formGuid',
      message: 'A non-empty form GUID is required.',
    });
  }
  if (!Number.isFinite(metadata.elapsedTime) || metadata.elapsedTime < 0) {
    diagnostics.push({
      code: 'SUBMISSION_ELAPSED_TIME_INVALID',
      path: 'elapsedTime',
      message: 'Elapsed time must be a finite non-negative number.',
    });
  }
  if (!answers.isValid) {
    diagnostics.push({
      code: 'SUBMISSION_ANSWER_PROJECTION_INVALID',
      path: 'answers',
      message: 'The answer projection contains errors and cannot be submitted.',
    });
  }
  if (metadata.isPartial) {
    if (!metadata.partialPayment?.partialRegisterFormQuestionUniqueId.trim()) {
      diagnostics.push({
        code: 'SUBMISSION_PARTIAL_QUESTION_ID_REQUIRED',
        path: 'partialPayment.partialRegisterFormQuestionUniqueId',
        message: 'Partial payment registration requires the payment question ID.',
      });
    }
    if (!metadata.partialPayment?.tenantPaymentGatewayId.trim()) {
      diagnostics.push({
        code: 'SUBMISSION_PAYMENT_GATEWAY_ID_REQUIRED',
        path: 'partialPayment.tenantPaymentGatewayId',
        message: 'Partial payment registration requires the tenant payment gateway ID.',
      });
    }
  }

  if (diagnostics.length) {
    for (const item of diagnostics) Object.freeze(item);
    return Object.freeze({ diagnostics: Object.freeze(diagnostics), isValid: false });
  }

  const guid = metadata.formGuid;
  const voterDetail = new CreateVoterDto({
    guid,
    elapsedTime: metadata.elapsedTime,
    // Preserve the original client behavior: zero coordinates/accuracy are omitted.
    latitude: metadata.latitude ? metadata.latitude : undefined,
    longitude: metadata.longitude ? metadata.longitude : undefined,
    gpsAccuracy: metadata.gpsAccuracy ? metadata.gpsAccuracy : undefined,
    regionUniqueId: metadata.regionUniqueId ? metadata.regionUniqueId : '',
    expressionActions: metadata.expressionActions,
    completionPercentage: metadata.completionPercentage,
    pollRoute: metadata.pollRoute,
    voiceRecordFileIdUnique: (metadata.voiceRecordFileIdUnique ?? []).map((file) =>
      new FileVoterAnswerDetailsDto({ fileUniqueId: file.fileUniqueId, order: file.order })),
  });
  const partialRegisterForPayment = metadata.isPartial
    ? new PartialRegisterForPaymentDto({
        partialRegisterFormQuestionUniqueId: metadata.partialPayment!.partialRegisterFormQuestionUniqueId,
        tenantPaymentGatewayId: metadata.partialPayment!.tenantPaymentGatewayId,
      })
    : undefined;

  const dto = new CreateVoterWithDetailsDto({
    guid,
    voterDetail,
    formSections: [...answers.formSections],
    variablesLastValue: { ...answers.variablesLastValue },
    allocationType: metadata.allocationType,
    temporarySave: metadata.temporarySave,
    acceptPreviousData: metadata.acceptPreviousData,
    partialRegisterForPayment,
  });

  return Object.freeze({
    dto,
    diagnostics: Object.freeze([]),
    isValid: true,
  });
}
