import { Injectable, InjectionToken, inject, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { AppConsts } from '@core/models/app-consts';
import {
  FileUploadRuntime,
  type FileUploadContext,
} from './file-upload-runtime';
import {
  TusJsFileUploadTransport,
  type TusHttpStackFactory,
  type TusUploadConstructor,
} from './tus-js-file-upload-transport';
import type { SurveyDefinition } from '../definition/definition.types';
import { SurveyFileUploadCoordinator } from './survey-file-upload-coordinator';
import {
  BrowserVoiceRecorder,
  type MediaRecorderFactory,
  type MediaRecorderLike,
  type MediaStreamLike,
  type VoiceMediaDevices,
} from './browser-voice-recorder';

/** The host application supplies the concrete tus-js-client Upload constructor. */
export const TUS_UPLOAD_CONSTRUCTOR = new InjectionToken<TusUploadConstructor>('TUS_UPLOAD_CONSTRUCTOR');
export const TUS_HTTP_STACK_FACTORY = new InjectionToken<TusHttpStackFactory>('TUS_HTTP_STACK_FACTORY');

export interface SurveyFileTransferSession {
  readonly runtime: FileUploadRuntime;
  readonly coordinator: SurveyFileUploadCoordinator;
}

/**
 * Angular composition root for the framework-independent upload runtime.
 * It deliberately requires an explicit tus-js-client constructor; no fake or
 * browser-global fallback is used when the dependency has not been installed.
 */
@Injectable({ providedIn: 'root' })
export class SurveyFileTransferHost {
  private readonly Upload = inject(TUS_UPLOAD_CONSTRUCTOR, { optional: true });
  private readonly httpStackFactory = inject(TUS_HTTP_STACK_FACTORY, { optional: true });

  get isAvailable(): boolean {
    return typeof this.Upload === 'function' && !!AppConsts.remoteBaseUrl?.trim();
  }

  createSession(definition: SurveyDefinition, context: FileUploadContext): SurveyFileTransferSession {
    if (!this.Upload) {
      throw new Error('tus-js-client is not configured. Provide TUS_UPLOAD_CONSTRUCTOR at the application root.');
    }
    const baseUrl = AppConsts.remoteBaseUrl?.replace(/\/+$/, '');
    if (!baseUrl) throw new Error('AppConsts.remoteBaseUrl is required for file uploads.');

    const runtime = new FileUploadRuntime(
      new TusJsFileUploadTransport(this.Upload, this.httpStackFactory ?? undefined),
      { endpoint: baseUrl + '/FileStorage_CDN' },
    );
    return Object.freeze({
      runtime,
      coordinator: new SurveyFileUploadCoordinator(definition, runtime, context),
    });
  }

  createBrowserVoiceRecorder(): BrowserVoiceRecorder {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined') {
      throw new Error('This browser does not support microphone recording.');
    }

    const mediaDevices: VoiceMediaDevices = {
      getUserMedia: async (constraints) =>
        await navigator.mediaDevices.getUserMedia(constraints) as unknown as MediaStreamLike,
    };
    const recorderFactory: MediaRecorderFactory = {
      isTypeSupported: (mimeType) => MediaRecorder.isTypeSupported(mimeType),
      create: (stream, mimeType) =>
        new MediaRecorder(stream as unknown as MediaStream, { mimeType }) as unknown as MediaRecorderLike,
    };
    return new BrowserVoiceRecorder(mediaDevices, recorderFactory);
  }
}

/** Register the real tus-js-client constructor in the consuming application's root providers. */
export function provideSurveyFileTransfer(
  Upload: TusUploadConstructor,
  createHttpStack?: TusHttpStackFactory,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TUS_UPLOAD_CONSTRUCTOR, useValue: Upload },
    ...(createHttpStack ? [{ provide: TUS_HTTP_STACK_FACTORY, useValue: createHttpStack }] : []),
  ]);
}
