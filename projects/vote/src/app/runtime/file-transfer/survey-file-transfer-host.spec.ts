import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AppConsts } from '@core/models/app-consts';
import type { TusUploadOptionsLike, TusUploadConstructor, TusUploadInstance } from './tus-js-file-upload-transport';
import { provideSurveyFileTransfer, SurveyFileTransferHost } from './survey-file-transfer-host';
import type { SurveyDefinition } from '../definition/definition.types';

class FakeUpload implements TusUploadInstance {
  static instances: Array<{ file: File; options: TusUploadOptionsLike }> = [];
  constructor(readonly file: File, readonly options: TusUploadOptionsLike) {
    FakeUpload.instances.push({ file, options });
  }
  findPreviousUploads = vi.fn(async () => []);
  resumeFromPreviousUpload = vi.fn();
  start = vi.fn();
  abort = vi.fn(async () => undefined);
}

const definition = {
  id: 'form', sections: [], questions: [], expressions: [], globalVariables: [],
} as unknown as SurveyDefinition;

describe('SurveyFileTransferHost', () => {
  it('composes the configured TUS constructor with the archived CDN endpoint and survey context', async () => {
    FakeUpload.instances = [];
    AppConsts.remoteBaseUrl = 'https://files.example.test/appapi/';
    TestBed.configureTestingModule({
      providers: [provideSurveyFileTransfer(FakeUpload as unknown as TusUploadConstructor)],
    });
    const host = TestBed.inject(SurveyFileTransferHost);
    expect(host.isAvailable).toBe(true);
    const session = host.createSession(definition, {
      formGuid: 'form-guid', pollUniqueId: 'poll-id', formUniqueId: 'form-unique-id', idCode: 123,
    });
    const state = session.runtime.add(new File(['data'], 'document.pdf'), {
      formGuid: 'form-guid', pollUniqueId: 'poll-id', formUniqueId: 'form-unique-id', idCode: 123,
    }, { uniqueId: 'upload-token' });
    expect(session.runtime.start(state.uploadId)).toBe(true);
    await Promise.resolve();
    expect(FakeUpload.instances[0].options.endpoint).toBe('https://files.example.test/appapi/FileStorage_CDN');
    expect(FakeUpload.instances[0].options.headers['fileToken']).toBe('upload-token');
    expect(FakeUpload.instances[0].options.metadata).toMatchObject({
      formGuid: 'form-guid', pollUniqueId: 'poll-id', formUniqueId: 'form-unique-id',
    });
    session.coordinator.dispose();
    TestBed.resetTestingModule();
    AppConsts.remoteBaseUrl = '';
  });

  it('fails explicitly when the host has not provided tus-js-client', () => {
    AppConsts.remoteBaseUrl = 'https://files.example.test/appapi';
    TestBed.configureTestingModule({ providers: [] });
    const host = TestBed.inject(SurveyFileTransferHost);
    expect(host.isAvailable).toBe(false);
    expect(() => host.createSession(definition, {
      formGuid: 'form', pollUniqueId: 'poll', formUniqueId: 'form',
    })).toThrow(/TUS_UPLOAD_CONSTRUCTOR/);
    TestBed.resetTestingModule();
    AppConsts.remoteBaseUrl = '';
  });
});
