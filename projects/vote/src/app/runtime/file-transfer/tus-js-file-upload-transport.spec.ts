import { describe, expect, it, vi } from 'vitest';
import { TusJsFileUploadTransport, type TusUploadOptionsLike } from './tus-js-file-upload-transport';

class FakeTusUpload {
  static instances: FakeTusUpload[] = [];
  readonly findPreviousUploads = vi.fn(async () => [{ url: 'previous-upload' }]);
  readonly resumeFromPreviousUpload = vi.fn();
  readonly start = vi.fn();
  readonly abort = vi.fn(async () => undefined);
  constructor(readonly file: File, readonly options: TusUploadOptionsLike) { FakeTusUpload.instances.push(this); }
}
function setup() {
  FakeTusUpload.instances = [];
  const failed: unknown[] = [];
  const progress: number[] = [];
  const retrying: unknown[] = [];
  const completed: unknown[] = [];
  const transport = new TusJsFileUploadTransport(FakeTusUpload, () => ({ custom: true }));
  const callbacks = {
    onProgress: (uploaded: number) => progress.push(uploaded),
    onRetrying: (error?: unknown) => retrying.push(error),
    onSuccess: (headers: unknown) => completed.push(headers),
    onError: (error: unknown) => failed.push(error),
  };
  const task = transport.createTask(new File(['data'], 'test.txt'), {
    endpoint: '/FileStorage_CDN', chunkSize: 1024, retryDelays: [100, 200],
    parallelUploads: 1, overridePatchMethod: true, patchContentType: 'application/octet-stream',
    nonRetryableHttpStatuses: [401, 403], headers: { fileToken: 'token' },
    metadata: {
      name: 'test.txt', filename: 'test.txt', emptyMetaKey: '', size: '4',
      formGuid: 'form', pollUniqueId: 'poll', idCode: '', formUniqueId: 'form-unique',
    }, resumePreviousUpload: true,
  }, callbacks);
  return { task, failed, progress, retrying, completed, upload: FakeTusUpload.instances[0] };
}

describe('TusJsFileUploadTransport', () => {
  it('resumes the first previous upload before starting', async () => {
    const { task, upload } = setup();
    await task.start();
    expect(upload.findPreviousUploads).toHaveBeenCalledOnce();
    expect(upload.resumeFromPreviousUpload).toHaveBeenCalledWith({ url: 'previous-upload' });
    expect(upload.start).toHaveBeenCalledOnce();
    expect(upload.options.httpStack).toEqual({ custom: true });
  });

  it('sets the required PATCH content type only for the FileStorage endpoint', () => {
    const { upload } = setup();
    const request = { getURL: () => 'https://cdn.test/FileStorage_CDN', setHeader: vi.fn() };
    upload.options.onBeforeRequest(request);
    expect(request.setHeader).toHaveBeenCalledWith('content-type', 'application/octet-stream');
    const other = { getURL: () => 'https://cdn.test/other', setHeader: vi.fn() };
    upload.options.onBeforeRequest(other);
    expect(other.setHeader).not.toHaveBeenCalled();
  });

  it('forwards progress, retry state and server response headers', () => {
    const { upload, progress, retrying, completed } = setup();
    upload.options.onProgress(2, 4);
    upload.options.onShouldRetry({ originalResponse: { getStatus: () => 500, getBody: () => '' } }, 1);
    upload.options.onAfterResponse({} as never, { getHeader: (name) => ({
      fileid: '12', fileidunique: 'unique', fileaddressurl: '/12',
    }[name]) });
    upload.options.onSuccess();
    expect(progress).toEqual([2]);
    expect(retrying).toHaveLength(1);
    expect(completed).toEqual([{ fileid: '12', fileidunique: 'unique', fileaddressurl: '/12' }]);
  });

  it('does not retry legacy terminal HTTP statuses and reports their body', () => {
    const onNonRetryableError = vi.fn();
    const transport = new TusJsFileUploadTransport(FakeTusUpload, undefined, onNonRetryableError);
    const task = transport.createTask(new File(['x'], 'x'), {
      endpoint: '/FileStorage_CDN', chunkSize: 1, retryDelays: [], parallelUploads: 1,
      overridePatchMethod: true, patchContentType: 'application/octet-stream',
      nonRetryableHttpStatuses: [401], headers: { fileToken: '' },
      metadata: { name: 'x', filename: 'x', emptyMetaKey: '', size: '1', formGuid: 'f', pollUniqueId: 'p', idCode: '', formUniqueId: 'u' },
      resumePreviousUpload: true,
    }, { onProgress: () => undefined, onRetrying: () => undefined, onSuccess: () => undefined, onError: () => undefined });
    const upload = FakeTusUpload.instances.at(-1)!;
    expect(upload.options.onShouldRetry({ originalResponse: { getStatus: () => 401, getBody: () => 'expired' } }, 0)).toBe(false);
    expect(onNonRetryableError).toHaveBeenCalledWith(401, 'expired');
    void task;
  });

  it('aborts before resume completes without starting a stale upload', async () => {
    const { task, upload } = setup();
    const start = task.start();
    await task.abort();
    await start;
    expect(upload.start).not.toHaveBeenCalled();
  });
});
