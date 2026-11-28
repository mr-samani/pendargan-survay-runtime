/**
 * Transport-independent upload lifecycle for FileUpload and VoiceRecord answers.
 * The legacy host uses tus-js-client; the TUS implementation remains a host adapter.
 */
export interface FileUploadContext {
  readonly formGuid: string;
  readonly pollUniqueId: string;
  readonly idCode?: string | number | null;
  readonly formUniqueId: string;
}
export interface FileUploadToken { readonly uniqueId?: string | null; }
export type FileUploadStatus = 'ready' | 'uploading' | 'retrying' | 'succeeded' | 'failed' | 'cancelled';
export interface UploadedFileReference {
  readonly fileId: string;
  readonly fileUniqueId: string;
  readonly addressUrl?: string;
}
export interface FileUploadState {
  readonly uploadId: string;
  readonly fileName: string;
  readonly extension: string;
  readonly fileType: string;
  readonly size: number;
  readonly status: FileUploadStatus;
  readonly progress: number;
  readonly uploadedBytes: number;
  readonly totalBytes: number;
  readonly result?: UploadedFileReference;
  readonly error?: unknown;
}
export interface TusFileUploadOptions {
  readonly endpoint: string;
  readonly chunkSize: number;
  readonly retryDelays: readonly number[];
  readonly parallelUploads: 1;
  readonly overridePatchMethod: true;
  readonly patchContentType: 'application/octet-stream';
  readonly nonRetryableHttpStatuses: readonly number[];
  readonly headers: Readonly<{ fileToken: string }>;
  readonly metadata: Readonly<{
    name: string; filename: string; emptyMetaKey: ''; size: string;
    formGuid: string; pollUniqueId: string; idCode: string; formUniqueId: string;
  }>;
  readonly resumePreviousUpload: true;
}
export interface FileUploadCallbacks {
  readonly onProgress: (uploadedBytes: number, totalBytes: number) => void;
  readonly onRetrying: (error?: unknown) => void;
  readonly onSuccess: (headers: Readonly<Record<string, string | undefined>>) => void;
  readonly onError: (error: unknown) => void;
}
export interface FileUploadTask {
  start(): void | Promise<void>;
  abort(): void | Promise<void>;
}
export interface FileUploadTransport {
  createTask(file: File, options: TusFileUploadOptions, callbacks: FileUploadCallbacks): FileUploadTask;
}
interface UploadEntry {
  readonly file: File;
  readonly context: FileUploadContext;
  readonly token: string;
  state: FileUploadState;
  task?: FileUploadTask;
  generation: number;
}
export interface FileUploadRuntimeOptions {
  readonly endpoint: string;
  readonly chunkSize?: number;
  readonly retryDelays?: readonly number[];
  readonly createUploadId?: () => string;
}

/** Owns immutable state, retry/cancel and stale-callback protection for one survey session. */
export class FileUploadRuntime {
  private readonly entries = new Map<string, UploadEntry>();
  private readonly listeners = new Set<(state: FileUploadState) => void>();
  private readonly chunkSize: number;
  private readonly retryDelays: readonly number[];
  private readonly createUploadId: () => string;
  private nextId = 0;
  private disposed = false;

  constructor(private readonly transport: FileUploadTransport, private readonly options: FileUploadRuntimeOptions) {
    if (!options.endpoint.trim()) throw new Error('A TUS upload endpoint is required.');
    this.chunkSize = options.chunkSize ?? 2 * 1024 * 1024;
    this.retryDelays = Object.freeze([...(options.retryDelays ?? [1000, 3000, 4000])]);
    this.createUploadId = options.createUploadId ?? (() => 'upload-' + (++this.nextId));
    if (!Number.isSafeInteger(this.chunkSize) || this.chunkSize <= 0) {
      throw new Error('The TUS chunk size must be a positive safe integer.');
    }
    if (this.retryDelays.some((delay) => !Number.isSafeInteger(delay) || delay < 0)) {
      throw new Error('TUS retry delays must be non-negative safe integers.');
    }
  }

  add(file: File, context: FileUploadContext, token?: FileUploadToken | null): FileUploadState {
    this.assertActive();
    if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || file.size < 0) {
      throw new Error('A valid browser File is required.');
    }
    assertContext(context);
    const uploadId = this.createUploadId();
    if (!uploadId || this.entries.has(uploadId)) throw new Error('The upload ID factory must return a unique non-empty ID.');
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    const state = freezeState({
      uploadId, fileName: file.name, extension, fileType: file.type,
      size: file.size, status: 'ready', progress: 0, uploadedBytes: 0, totalBytes: file.size,
    });
    this.entries.set(uploadId, {
      file, context: Object.freeze({ ...context }), token: token?.uniqueId ?? '', state, generation: 0,
    });
    this.emit(state);
    return state;
  }

  getState(uploadId: string): FileUploadState | undefined { return this.entries.get(uploadId)?.state; }
  getStates(): readonly FileUploadState[] {
    return Object.freeze([...this.entries.values()].map((entry) => entry.state));
  }
  subscribe(listener: (state: FileUploadState) => void): () => void {
    this.assertActive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(uploadId: string): boolean {
    if (this.disposed) return false;
    const entry = this.entries.get(uploadId);
    if (!entry || ['uploading', 'retrying', 'succeeded'].includes(entry.state.status)) return false;
    entry.task?.abort();
    const generation = ++entry.generation;
    this.update(entry, {
      status: 'uploading', progress: 0, uploadedBytes: 0, totalBytes: entry.file.size,
      result: undefined, error: undefined,
    });
    const callbacks: FileUploadCallbacks = {
      onProgress: (uploadedBytes, totalBytes) => {
        if (!this.isCurrent(entry, generation)) return;
        const total = Number.isFinite(totalBytes) && totalBytes >= 0 ? totalBytes : entry.file.size;
        const uploaded = Number.isFinite(uploadedBytes) ? Math.max(0, Math.min(uploadedBytes, total)) : 0;
        this.update(entry, {
          uploadedBytes: uploaded, totalBytes: total,
          progress: total > 0 ? Math.min(100, uploaded / total * 100) : 100,
        });
      },
      onRetrying: (error) => {
        if (this.isCurrent(entry, generation)) this.update(entry, { status: 'retrying', error });
      },
      onSuccess: (headers) => {
        if (!this.isCurrent(entry, generation)) return;
        const fileId = header(headers, 'fileid');
        const fileUniqueId = header(headers, 'fileidunique');
        const addressUrl = header(headers, 'fileaddressurl');
        if (!fileId || !fileUniqueId) {
          this.update(entry, { status: 'failed', error: new Error('TUS response is missing fileid or fileidunique.') });
          entry.task = undefined;
          return;
        }
        this.update(entry, {
          status: 'succeeded', progress: 100, uploadedBytes: entry.file.size, totalBytes: entry.file.size,
          result: Object.freeze({ fileId, fileUniqueId, ...(addressUrl ? { addressUrl } : {}) }), error: undefined,
        });
        entry.task = undefined;
      },
      onError: (error) => {
        if (!this.isCurrent(entry, generation)) return;
        this.update(entry, { status: 'failed', error });
        entry.task = undefined;
      },
    };
    try {
      entry.task = this.transport.createTask(entry.file, this.createTransportOptions(entry), callbacks);
      Promise.resolve(entry.task.start()).catch(callbacks.onError);
    } catch (error) { callbacks.onError(error); }
    return true;
  }

  retry(uploadId: string): boolean {
    const entry = this.entries.get(uploadId);
    return !!entry && entry.state.status === 'failed' && this.start(uploadId);
  }

  cancel(uploadId: string): boolean {
    const entry = this.entries.get(uploadId);
    if (!entry || !['uploading', 'retrying'].includes(entry.state.status)) return false;
    ++entry.generation;
    const task = entry.task;
    entry.task = undefined;
    this.update(entry, { status: 'cancelled', error: undefined });
    try { void task?.abort(); } catch { /* cancellation remains authoritative */ }
    return true;
  }

  remove(uploadId: string): boolean {
    const entry = this.entries.get(uploadId);
    if (!entry || ['uploading', 'retrying'].includes(entry.state.status)) return false;
    return this.entries.delete(uploadId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.entries.values()) {
      ++entry.generation;
      try { void entry.task?.abort(); } catch { /* continue disposing other uploads */ }
      entry.task = undefined;
    }
    this.listeners.clear();
    this.entries.clear();
  }

  private createTransportOptions(entry: UploadEntry): TusFileUploadOptions {
    return Object.freeze({
      endpoint: this.options.endpoint, chunkSize: this.chunkSize, retryDelays: this.retryDelays,
      parallelUploads: 1, overridePatchMethod: true,
      patchContentType: 'application/octet-stream',
      nonRetryableHttpStatuses: Object.freeze([401, 403, 404, 406, 417, 410, 415, 510]),
      headers: Object.freeze({ fileToken: entry.token }),
      metadata: Object.freeze({
        name: entry.file.name, filename: entry.file.name, emptyMetaKey: '',
        size: String(entry.file.size), formGuid: entry.context.formGuid,
        pollUniqueId: String(entry.context.pollUniqueId), idCode: String(entry.context.idCode ?? ''),
        formUniqueId: String(entry.context.formUniqueId),
      }),
      resumePreviousUpload: true,
    });
  }

  private isCurrent(entry: UploadEntry, generation: number): boolean {
    return !this.disposed && this.entries.get(entry.state.uploadId) === entry &&
      entry.generation === generation && ['uploading', 'retrying'].includes(entry.state.status);
  }
  private update(entry: UploadEntry, patch: Partial<FileUploadState>): void {
    entry.state = freezeState({ ...entry.state, ...patch });
    this.emit(entry.state);
  }
  private emit(state: FileUploadState): void {
    for (const listener of [...this.listeners]) listener(state);
  }
  private assertActive(): void {
    if (this.disposed) throw new Error('The file upload runtime has been disposed.');
  }
}

function assertContext(context: FileUploadContext): void {
  if (!context || !context.formGuid?.trim() || !context.pollUniqueId?.trim() || !context.formUniqueId?.trim()) {
    throw new Error('formGuid, pollUniqueId and formUniqueId are required for TUS metadata.');
  }
}
function header(headers: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
  const value = key ? headers[key]?.trim() : undefined;
  return value || undefined;
}
function freezeState(state: FileUploadState): FileUploadState { return Object.freeze({ ...state }); }
