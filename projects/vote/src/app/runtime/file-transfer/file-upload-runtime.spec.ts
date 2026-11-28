import { describe, expect, it, vi } from 'vitest';
import {
  FileUploadRuntime, type FileUploadCallbacks, type FileUploadTask,
  type FileUploadTransport, type TusFileUploadOptions,
} from './file-upload-runtime';

class FakeTransport implements FileUploadTransport {
  readonly calls: Array<{ file: File; options: TusFileUploadOptions; callbacks: FileUploadCallbacks; task: FileUploadTask }> = [];
  createTask(file: File, options: TusFileUploadOptions, callbacks: FileUploadCallbacks): FileUploadTask {
    const task: FileUploadTask = { start: vi.fn(), abort: vi.fn() };
    this.calls.push({ file, options, callbacks, task });
    return task;
  }
}
const context = { formGuid: 'form-guid', pollUniqueId: 'poll-id', idCode: 12345, formUniqueId: 'form-unique-id' };
function setup() {
  const transport = new FakeTransport();
  const runtime = new FileUploadRuntime(transport, {
    endpoint: 'https://cdn.example.test/FileStorage_CDN', createUploadId: () => 'file-1',
  });
  const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
  const state = runtime.add(file, context, { uniqueId: 'file-token' });
  return { runtime, transport, file, state };
}

describe('FileUploadRuntime', () => {
  it('preserves the archived TUS endpoint, metadata, token and retry configuration', () => {
    const { runtime, transport, state, file } = setup();
    expect(runtime.start(state.uploadId)).toBe(true);
    expect(transport.calls[0].file).toBe(file);
    expect(transport.calls[0].options).toMatchObject({
      endpoint: 'https://cdn.example.test/FileStorage_CDN', chunkSize: 2 * 1024 * 1024,
      retryDelays: [1000, 3000, 4000], parallelUploads: 1, overridePatchMethod: true,
      headers: { fileToken: 'file-token' }, resumePreviousUpload: true,
      metadata: {
        name: 'hello.txt', filename: 'hello.txt', emptyMetaKey: '', size: '5',
        formGuid: 'form-guid', pollUniqueId: 'poll-id', idCode: '12345', formUniqueId: 'form-unique-id',
      },
    });
    runtime.dispose();
  });

  it('tracks progress and maps case-insensitive response headers', () => {
    const { runtime, transport, state } = setup();
    runtime.start(state.uploadId);
    const callbacks = transport.calls[0].callbacks;
    callbacks.onProgress(3, 5);
    expect(runtime.getState(state.uploadId)).toMatchObject({ status: 'uploading', uploadedBytes: 3, totalBytes: 5, progress: 60 });
    callbacks.onSuccess({ FILEID: '42', FileIdUnique: 'unique-id', FileAddressUrl: 'https://cdn.test/42' });
    expect(runtime.getState(state.uploadId)).toMatchObject({
      status: 'succeeded', progress: 100,
      result: { fileId: '42', fileUniqueId: 'unique-id', addressUrl: 'https://cdn.test/42' },
    });
    runtime.dispose();
  });

  it('fails closed when the server omits a required file identifier', () => {
    const { runtime, transport, state } = setup();
    runtime.start(state.uploadId);
    transport.calls[0].callbacks.onSuccess({ fileid: '42' });
    expect(runtime.getState(state.uploadId)?.status).toBe('failed');
    expect(runtime.getState(state.uploadId)?.error).toBeInstanceOf(Error);
    runtime.dispose();
  });

  it('retries failed uploads and ignores callbacks from superseded attempts', () => {
    const { runtime, transport, state } = setup();
    runtime.start(state.uploadId);
    const previous = transport.calls[0].callbacks;
    previous.onError(new Error('network'));
    expect(runtime.retry(state.uploadId)).toBe(true);
    previous.onSuccess({ fileid: 'stale', fileidunique: 'stale-id' });
    expect(runtime.getState(state.uploadId)?.status).toBe('uploading');
    transport.calls[1].callbacks.onSuccess({ fileid: '2', fileidunique: 'current-id' });
    expect(runtime.getState(state.uploadId)?.result?.fileUniqueId).toBe('current-id');
    runtime.dispose();
  });

  it('cancels the task and ignores a late completion callback', () => {
    const { runtime, transport, state } = setup();
    runtime.start(state.uploadId);
    const callbacks = transport.calls[0].callbacks;
    expect(runtime.cancel(state.uploadId)).toBe(true);
    expect(transport.calls[0].task.abort).toHaveBeenCalledOnce();
    callbacks.onSuccess({ fileid: '1', fileidunique: 'late-id' });
    expect(runtime.getState(state.uploadId)?.status).toBe('cancelled');
    runtime.dispose();
  });

  it('prevents duplicate active starts and restarting a successful upload', () => {
    const { runtime, transport, state } = setup();
    expect(runtime.start(state.uploadId)).toBe(true);
    expect(runtime.start(state.uploadId)).toBe(false);
    transport.calls[0].callbacks.onSuccess({ fileid: '1', fileidunique: 'saved' });
    expect(runtime.start(state.uploadId)).toBe(false);
    expect(transport.calls).toHaveLength(1);
    runtime.dispose();
  });

  it('publishes immutable state and supports removal of inactive uploads', () => {
    const { runtime, state } = setup();
    const seen: string[] = [];
    const unsubscribe = runtime.subscribe((next) => seen.push(next.status));
    expect(Object.isFrozen(state)).toBe(true);
    expect(runtime.remove(state.uploadId)).toBe(true);
    expect(seen).toEqual([]);
    unsubscribe();
    runtime.dispose();
  });

  it('rejects invalid endpoint, chunk size and incomplete metadata', () => {
    const transport = new FakeTransport();
    expect(() => new FileUploadRuntime(transport, { endpoint: '' })).toThrow();
    expect(() => new FileUploadRuntime(transport, { endpoint: '/upload', chunkSize: 0 })).toThrow();
    const runtime = new FileUploadRuntime(transport, { endpoint: '/upload' });
    expect(() => runtime.add(new File(['x'], 'x.txt'), { formGuid: '', pollUniqueId: 'p', formUniqueId: 'f' })).toThrow();
    runtime.dispose();
  });

  it('aborts active uploads during disposal and prevents later operations', () => {
    const { runtime, transport, state } = setup();
    runtime.start(state.uploadId);
    runtime.dispose();
    expect(transport.calls[0].task.abort).toHaveBeenCalledOnce();
    expect(runtime.getStates()).toEqual([]);
    expect(runtime.start(state.uploadId)).toBe(false);
    expect(() => runtime.add(new File(['x'], 'x.txt'), context)).toThrow();
  });
});
