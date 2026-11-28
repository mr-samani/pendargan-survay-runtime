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
  | { readonly status: 'submitted'; readonly response: RuntimeSubmissionApiResponse; readonly build: RuntimeSubmissionResult }
  | { readonly status: 'temporary-saved'; readonly response: RuntimeSubmissionApiResponse; readonly build: RuntimeSubmissionResult }
  | { readonly status: 'rejected'; readonly build?: RuntimeSubmissionResult; readonly reason: string }
  | { readonly status: 'failed'; readonly build: RuntimeSubmissionResult; readonly error: unknown; readonly response?: RuntimeSubmissionApiResponse };

export interface RuntimeSubmissionHooks {
  /** Resolve GPS, poll route, voice recording upload metadata, and other platform-specific fields. */
  readonly prepareMetadata?: (metadata: SurveySubmissionMetadata) => Promise<SurveySubmissionMetadata>;
  /** Fail closed when host-managed work (for example, file uploads) is not ready. */
  readonly assertReadyForSubmission?: () => void;
  /** Runs legacy UI follow-up after the shared save endpoint accepts a temporary save. */
  readonly onTemporarySaved?: (response: RuntimeSubmissionApiResponse) => void;
  readonly onPartialSuccess?: (
    partialQuestionUniqueId: string,
    response: RuntimeSubmissionApiResponse,
  ) => void;
  readonly onSuccess?: (response: RuntimeSubmissionApiResponse) => void;
  readonly onError?: (error: unknown) => void;
  /** Receives exceptions thrown by post-request callbacks without changing the persisted request outcome. */
  readonly onCallbackError?: (error: unknown) => void;
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
    private readonly send: (dto: CreateVoterWithDetailsDto) => Observable<RuntimeSubmissionApiResponse>,
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
      hooks.assertReadyForSubmission?.();
      build = buildSurveyRuntimeSubmission(definition, session, prepared, options);
      if (!build.payload.isValid || !build.payload.dto) {
        return {
          status: 'rejected',
          build,
          reason: build.payload.diagnostics.map((item) => item.message).join(' '),
        };
      }

      const response = await firstValueFrom(this.send(build.payload.dto));
      // ABP may return HTTP 200 with success=false. Treat that as a server
      // business failure and do not execute any post-save success callback.
      if (response.success === false) {
        const error = new Error(response.error?.message || response.message || 'The server rejected the survey submission.');
        this.invokeHook(hooks.onError, [error], hooks.onCallbackError);
        return { status: 'failed', build, error, response };
      }

      if (prepared.temporarySave) {
        this.invokeHook(hooks.onTemporarySaved, [response], hooks.onCallbackError);
        return { status: 'temporary-saved', response, build };
      }
      if (prepared.isPartial && prepared.partialPayment) {
        this.invokeHook(
          hooks.onPartialSuccess,
          [prepared.partialPayment.partialRegisterFormQuestionUniqueId, response],
          hooks.onCallbackError,
        );
      } else {
        this.invokeHook(hooks.onSuccess, [response], hooks.onCallbackError);
      }
      return { status: 'submitted', response, build };
    } catch (error) {
      this.invokeHook(hooks.onError, [error], hooks.onCallbackError);
      return build
        ? { status: 'failed', build, error }
        : { status: 'rejected', reason: error instanceof Error ? error.message : 'Submission preparation failed.' };
    } finally {
      this.inFlight = false;
    }
  }

  /** Post-request UI callbacks cannot roll back a request already accepted by the server. */
  private invokeHook<TArgs extends readonly unknown[]>(
    callback: ((...args: TArgs) => void) | undefined,
    args: TArgs,
    reporter?: (error: unknown) => void,
  ): void {
    if (!callback) return;
    try {
      callback(...args);
    } catch (error) {
      try { reporter?.(error); } catch { /* A diagnostic callback must not change the API outcome. */ }
    }
  }
}
