import {
  type FileUploadCallbacks,
  type FileUploadTask,
  type FileUploadTransport,
  type TusFileUploadOptions,
} from './file-upload-runtime';

/** Minimal structural surface of tus-js-client, so the runtime does not own the package dependency. */
export interface TusHttpRequest {
  getURL(): string;
  setHeader(name: string, value: string): void;
}
export interface TusHttpResponse {
  getHeader(name: string): string | undefined;
}
export interface TusError {
  readonly originalResponse?: {
    getStatus(): number;
    getBody(): string;
  };
}
export interface TusUploadInstance {
  findPreviousUploads(): Promise<readonly unknown[]>;
  resumeFromPreviousUpload(previousUpload: unknown): void;
  start(): void;
  abort(shouldTerminate?: boolean): Promise<void>;
}
export interface TusUploadOptionsLike {
  endpoint: string;
  retryDelays: readonly number[];
  chunkSize: number;
  metadata: Record<string, string>;
  headers: Record<string, string>;
  overridePatchMethod: boolean;
  parallelUploads: number;
  httpStack?: unknown;
  onBeforeRequest(request: TusHttpRequest): void;
  onProgress(bytesUploaded: number, bytesTotal: number): void;
  onError(error: TusError): void;
  onSuccess(): void;
  onShouldRetry(error: TusError, retryAttempt: number): boolean;
  onAfterResponse(request: TusHttpRequest, response: TusHttpResponse): void;
}
export interface TusUploadConstructor {
  new (file: File, options: TusUploadOptionsLike): TusUploadInstance;
}
export type TusHttpStackFactory = () => unknown;

/**
 * Production adapter for tus-js-client. The host supplies its installed Upload
 * constructor and optional custom HTTP stack, keeping this runtime package-neutral.
 */
export class TusJsFileUploadTransport implements FileUploadTransport {
  constructor(
    private readonly Upload: TusUploadConstructor,
    private readonly createHttpStack?: TusHttpStackFactory,
    private readonly onNonRetryableError?: (status: number, body: string) => void,
  ) {}

  createTask(file: File, options: TusFileUploadOptions, callbacks: FileUploadCallbacks): FileUploadTask {
    let started = false;
    let aborted = false;
    let settled = false;
    const responseHeaders: Record<string, string> = {};

    const upload = new this.Upload(file, {
      endpoint: options.endpoint,
      retryDelays: [...options.retryDelays],
      chunkSize: options.chunkSize,
      metadata: { ...options.metadata },
      headers: { ...options.headers },
      overridePatchMethod: options.overridePatchMethod,
      parallelUploads: options.parallelUploads,
      ...(this.createHttpStack ? { httpStack: this.createHttpStack() } : {}),
      onBeforeRequest: (request) => {
        if (request.getURL().replace(/\/+$/, '').endsWith('/FileStorage_CDN')) {
          request.setHeader('content-type', options.patchContentType);
        }
      },
      onProgress: (uploaded, total) => {
        if (!aborted && !settled) callbacks.onProgress(uploaded, total);
      },
      onError: (error) => {
        if (aborted || settled) return;
        settled = true;
        callbacks.onError(error);
      },
      onSuccess: () => {
        if (aborted || settled) return;
        settled = true;
        callbacks.onSuccess(responseHeaders);
      },
      onShouldRetry: (error) => {
        const status = error.originalResponse?.getStatus() ?? 0;
        if (options.nonRetryableHttpStatuses.includes(status)) {
          this.onNonRetryableError?.(status, error.originalResponse?.getBody() ?? '');
          return false;
        }
        if (!aborted && !settled) callbacks.onRetrying(error);
        return true;
      },
      onAfterResponse: (_request, response) => {
        for (const name of ['fileid', 'fileidunique', 'fileaddressurl']) {
          const value = response.getHeader(name);
          if (value) responseHeaders[name] = value;
        }
      },
    });

    return {
      start: async () => {
        if (started || aborted) return;
        started = true;
        const previousUploads = options.resumePreviousUpload ? await upload.findPreviousUploads() : [];
        if (aborted) return;
        if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
        if (aborted) return;
        upload.start();
      },
      abort: async () => {
        if (aborted) return;
        aborted = true;
        await upload.abort();
      },
    };
  }
}
