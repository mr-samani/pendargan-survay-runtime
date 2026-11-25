import type { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type {
  CreateOrEditVoterAndDetailsOutputDto,
  CreateVoterWithDetailsDto,
} from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyRuntimeSessionSnapshot } from '../session/runtime-session';
import {
  buildSurveyRuntimeSubmission,
  type RuntimeSubmissionOptions,
  type RuntimeSubmissionResult,
} from './survey-runtime-submission';
import type { SurveySubmissionMetadata } from './submission-payload-builder';

export type RuntimeSubmissionApiResponse = CreateOrEditVoterAndDetailsOutputDto & {
  readonly success?: boolean;
  readonly error?: { readonly message?: string | null } | null;
};

export type RuntimeSubmissionOutcome =
  | { readonly status: 'submitted'; readonly response: CreateOrEditVoterAndDetailsOutputDto; readonly build: RuntimeSubmissionResult }
  | { readonly status: 'temporary-saved'; readonly response: RuntimeSubmissionApiResponse; readonly build: RuntimeSubmissionResult }
  | { readonly status: 'rejected'; readonly build?: RuntimeSubmissionResult; readonly reason: string }
  | { readonly status: 'failed'; readonly build: RuntimeSubmissionResult; readonly error: unknown; readonly response?: RuntimeSubmissionApiResponse };

export interface RuntimeSubmissionHooks {
  /** Resolve GPS, poll route, voice recording upload metadata, and other platform-specific fields. */
  readonly prepareMetadata?: (metadata: SurveySubmissionMetadata) => Promise<SurveySubmissionMetadata>;
  /** Runs legacy UI follow-up after the shared save endpoint accepts a temporary save. */
  readonly onTemporarySaved?: (response: RuntimeSubmissionApiResponse) => void;
  readonly onPartialSuccess?: (
    partialQuestionUniqueId: string,
    response: CreateOrEditVoterAndDetailsOutputDto,
  ) => void;
  readonly onSuccess?: (response: RuntimeSubmissionApiResponse) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Coordinates canonical payload construction and the generated Voting API call.
 * Platform-specific GPS/TUS/cookie/navigation behavior is injected explicitly.
 * The archived client uses this same API for final and temporary saves; the
 * temporarySave flag and post-save UI behavior distinguish the two workflows.
 */
export class RuntimeSubmissionCoordinator {
  private inFlight = false;

  constructor(
    private readonly send: (dto: CreateVoterWithDetailsDto) => Observable<CreateOrEditVoterAndDetailsOutputDto>,
  ) {}

  get isSubmitting(): boolean {
    return this.inFlight;
  }

  async submit(
    definition: SurveyDefinition,
    session: SurveyRuntimeSessionSnapshot,
    metadata: SurveySubmissionMetadata,
    options: RuntimeSubmissionOptions = {},
    hooks: RuntimeSubmissionHooks = {},
  ): Promise<RuntimeSubmissionOutcome> {
    if (this.inFlight) return { status: 'rejected', reason: 'A submission is already in progress.' };

    this.inFlight = true;
    let build: RuntimeSubmissionResult | undefined;
    try {
      const prepared = hooks.prepareMetadata
        ? await hooks.prepareMetadata(metadata)
        : metadata;
      build = buildSurveyRuntimeSubmission(definition, session, prepared, options);
      if (!build.payload.isValid || !build.payload.dto) {
        return {
          status: 'rejected',
          build,
          reason: build.payload.diagnostics.map((item) => item.message).join(' '),
        };
      }

      const response = await firstValueFrom(this.send(build.payload.dto));
      if (prepared.temporarySave) {
        hooks.onTemporarySaved?.(response);
        return { status: 'temporary-saved', response, build };
      }
      if (prepared.isPartial && prepared.partialPayment) {
        hooks.onPartialSuccess?.(prepared.partialPayment.partialRegisterFormQuestionUniqueId, response);
      } else {
        hooks.onSuccess?.(response);
      }
      return { status: 'submitted', response, build };
    } catch (error) {
      hooks.onError?.(error);
      return build
        ? { status: 'failed', build, error }
        : { status: 'rejected', reason: error instanceof Error ? error.message : 'Submission preparation failed.' };
    } finally {
      this.inFlight = false;
    }
  }
}
