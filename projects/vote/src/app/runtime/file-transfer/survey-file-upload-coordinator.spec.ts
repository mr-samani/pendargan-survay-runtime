import { describe, expect, it, vi } from 'vitest';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import { FileUploadRuntime, type FileUploadCallbacks, type FileUploadTask, type FileUploadTransport, type TusFileUploadOptions } from './file-upload-runtime';
import { SurveyFileUploadCoordinator, FileUploadRejectedError } from './survey-file-upload-coordinator';

class FakeTransport implements FileUploadTransport {
  readonly calls: Array<{ file: File; options: TusFileUploadOptions; callbacks: FileUploadCallbacks }> = [];
  createTask(file: File, options: TusFileUploadOptions, callbacks: FileUploadCallbacks): FileUploadTask {
    this.calls.push({ file, options, callbacks });
    return { start: vi.fn(), abort: vi.fn() };
  }
}
const source = {
  fileUploadSettingDto: { extension: '.pdf،jpg', minSize: 0, maxSize: 100, maxFileCount: 2 },
  formQuestionFileUploadTokenDtos: [{ uniqueId: 'token-1' }, { uniqueId: 'token-2' }],
};
const question = {
  id: 'question-1', source, sourceId: 'q1', isActive: true, isRequired: false, options: [], settings: null,
} as unknown as SurveyQuestionDefinition;
const definition = { id: 'form', formGuid: 'guid', sections: [], questions: [question], expressions: [], globalVariables: [] } as SurveyDefinition;
const context = { formGuid: 'guid', pollUniqueId: 'poll', formUniqueId: 'form', idCode: 77 };
function setup() {
  const transport = new FakeTransport();
  const runtime = new FileUploadRuntime(transport, { endpoint: '/FileStorage_CDN', createUploadId: (() => {
    let index = 0;
    return () => 'upload-' + ++index;
  })() });
  const coordinator = new SurveyFileUploadCoordinator(definition, runtime, context);
  return { transport, runtime, coordinator };
}
describe('SurveyFileUploadCoordinator', () => {
  it('resolves a different server token for each selected file slot', () => {
    const { coordinator, transport } = setup();
    coordinator.upload('question-1', new File(['one'], 'one.pdf'));
    coordinator.upload('question-1', new File(['two'], 'two.jpg'));
    expect(transport.calls.map((call) => call.options.headers.fileToken)).toEqual(['token-1', 'token-2']);
    coordinator.dispose();
  });
  it('validates extensions and size using archived KB rounding', () => {
    const { coordinator } = setup();
    expect(() => coordinator.upload('question-1', new File(['x'], 'file.exe'))).toThrowError(
      expect.objectContaining({ code: 'FILE_EXTENSION_NOT_ALLOWED' }),
    );
    expect(() => coordinator.upload('question-1', new File(['x'.repeat(1024 * 101)], 'large.pdf'))).toThrowError(
      expect.objectContaining({ code: 'FILE_SIZE_ABOVE_MAXIMUM' }),
    );
    coordinator.dispose();
  });
  it('enforces the minimum size with the archived KB rounding rule', () => {
    const strictQuestion = {
      ...question,
      source: {
        ...source,
        fileUploadSettingDto: { ...source.fileUploadSettingDto, minSize: 1 },
      },
    } as SurveyQuestionDefinition;
    const strictDefinition = { ...definition, questions: [strictQuestion] };
    const transport = new FakeTransport();
    const runtime = new FileUploadRuntime(transport, { endpoint: '/FileStorage_CDN' });
    const coordinator = new SurveyFileUploadCoordinator(strictDefinition, runtime, context);
    expect(() => coordinator.upload('question-1', new File(['x'.repeat(511)], 'small.pdf'))).toThrowError(
      expect.objectContaining({ code: 'FILE_SIZE_BELOW_MINIMUM' }),
    );
    expect(() => coordinator.upload('question-1', new File(['x'.repeat(512)], 'rounded.pdf'))).not.toThrow();
    coordinator.dispose();
  });
  it('enforces max count across concurrent in-flight uploads', () => {
    const { coordinator } = setup();
    coordinator.upload('question-1', new File(['one'], 'one.pdf'));
    coordinator.upload('question-1', new File(['two'], 'two.pdf'));
    expect(() => coordinator.upload('question-1', new File(['three'], 'three.pdf'))).toThrowError(
      expect.objectContaining({ code: 'FILE_COUNT_ABOVE_MAXIMUM' }),
    );
    coordinator.dispose();
  });
  it('converts only successful question uploads into immutable answer values', () => {
    const { coordinator, transport } = setup();
    coordinator.upload('question-1', new File(['data'], 'doc.pdf'));
    transport.calls[0].callbacks.onSuccess({ fileid: '10', fileidunique: 'server-id' });
    const answer = coordinator.buildAnswer('question-1');
    expect(answer).toHaveLength(1);
    expect(answer[0]).toMatchObject({ fileId: 10, fileUniqueId: 'server-id', name: 'doc.pdf', progress: 100 });
    expect(Object.isFrozen(answer)).toBe(true);
    expect(coordinator.buildAnswer('question-1', answer as never)).toHaveLength(1);
    coordinator.dispose();
  });
  it('keeps failed and cancelled uploads out of answers and allows a retry', () => {
    const { coordinator, transport } = setup();
    const upload = coordinator.upload('question-1', new File(['data'], 'doc.pdf'));
    transport.calls[0].callbacks.onError(new Error('network'));
    expect(coordinator.buildAnswer('question-1')).toHaveLength(0);
    expect(coordinator.retry(upload.uploadId)).toBe(true);
    transport.calls[1].callbacks.onSuccess({ fileid: '11', fileidunique: 'server-id' });
    expect(coordinator.buildAnswer('question-1')).toHaveLength(1);
    coordinator.dispose();
  });
  it('rejects unknown question IDs and use after disposal', () => {
    const { coordinator } = setup();
    expect(() => coordinator.upload('missing', new File(['x'], 'x.pdf'))).toThrowError(
      expect.objectContaining({ code: 'QUESTION_NOT_FOUND' }),
    );
    coordinator.dispose();
    expect(() => coordinator.upload('question-1', new File(['x'], 'x.pdf'))).toThrow();
  });
});
