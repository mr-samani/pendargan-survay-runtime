import { Injectable } from '@angular/core';
import { AppConsts } from '@core/models/app-consts';
import {
  FileUploadRuntime,
  type FileUploadContext,
} from './file-upload-runtime';
import {
  TusJsFileUploadTransport,
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
  get isAvailable(): boolean {
    return !!AppConsts.remoteBaseUrl?.trim();
  }

  /** Loads tus-js-client only when a survey actually needs file transfer. */
  async createSession(definition: SurveyDefinition, context: FileUploadContext): Promise<SurveyFileTransferSession> {
    const baseUrl = AppConsts.remoteBaseUrl?.replace(/\/+$/, '');
    if (!baseUrl) throw new Error('AppConsts.remoteBaseUrl is required for file uploads.');
    const { Upload } = await import('tus-js-client');
    const runtime = new FileUploadRuntime(
      new TusJsFileUploadTransport(Upload as unknown as import('./tus-js-file-upload-transport').TusUploadConstructor),
      { endpoint: baseUrl + '/FileStorage_CDN' },
    );
    return Object.freeze({ runtime, coordinator: new SurveyFileUploadCoordinator(definition, runtime, context) });
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
