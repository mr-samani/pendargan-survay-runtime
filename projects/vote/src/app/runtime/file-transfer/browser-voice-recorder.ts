export type VoiceRecordingStatus = 'idle' | 'requesting-permission' | 'recording' | 'stopping' | 'recorded' | 'error';
export interface VoiceRecordingSnapshot {
  readonly status: VoiceRecordingStatus;
  readonly durationMs: number;
  readonly mimeType?: string;
  readonly error?: unknown;
}
export interface RecordedAudioFile {
  readonly blob: Blob;
  readonly file: File;
  readonly mimeType: string;
  readonly durationMs: number;
}
export interface MediaStreamTrackLike { stop(): void; }
export interface MediaStreamLike { getTracks(): readonly MediaStreamTrackLike[]; }
export interface MediaRecorderLike {
  readonly state: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}
export interface MediaRecorderFactory {
  create(stream: MediaStreamLike, mimeType: string): MediaRecorderLike;
  isTypeSupported(mimeType: string): boolean;
}
export interface VoiceMediaDevices { getUserMedia(constraints: { audio: true }): Promise<MediaStreamLike>; }
const DEFAULT_MIME_TYPES = Object.freeze([
  'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg',
]);

/** Browser recorder independent from Angular, Xamarin and KBrowser bridges. */
export class BrowserVoiceRecorder {
  private snapshot: VoiceRecordingSnapshot = Object.freeze({ status: 'idle', durationMs: 0 });
  private readonly listeners = new Set<(state: VoiceRecordingSnapshot) => void>();
  private recorder?: MediaRecorderLike;
  private stream?: MediaStreamLike;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private disposed = false;
  private operationGeneration = 0;
  private pendingStop?: { resolve: (result: RecordedAudioFile) => void; reject: (error: unknown) => void };
  private pendingFileName?: string;

  constructor(
    private readonly mediaDevices: VoiceMediaDevices,
    private readonly recorderFactory: MediaRecorderFactory,
    private readonly now: () => number = () => Date.now(),
    private readonly createFile: (blob: Blob, name: string) => File = (blob, name) => new File([blob], name, { type: blob.type }),
  ) {}

  getState(): VoiceRecordingSnapshot { return this.snapshot; }
  subscribe(listener: (state: VoiceRecordingSnapshot) => void): () => void {
    this.assertActive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<boolean> {
    this.assertActive();
    if (this.snapshot.status === 'recording' || this.snapshot.status === 'requesting-permission' || this.snapshot.status === 'stopping') return false;
    this.releaseStream();
    this.chunks = [];
    const generation = ++this.operationGeneration;
    this.publish({ status: 'requesting-permission', durationMs: 0, error: undefined });
    try {
      const mimeType = DEFAULT_MIME_TYPES.find((type) => this.recorderFactory.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser does not support a compatible audio recording format.');
      const stream = await this.mediaDevices.getUserMedia({ audio: true });
      if (this.disposed || generation !== this.operationGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;
      const recorder = this.recorderFactory.create(stream, mimeType);
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (generation === this.operationGeneration && event.data.size > 0) this.chunks.push(event.data);
      };
      recorder.onerror = (error) => {
        if (generation === this.operationGeneration) this.fail(error, generation);
      };
      recorder.onstop = () => this.completeStop(mimeType, generation);
      this.startedAt = this.now();
      recorder.start();
      this.publish({ status: 'recording', durationMs: 0, mimeType });
      return true;
    } catch (error) {
      if (generation !== this.operationGeneration || this.disposed) return false;
      this.releaseStream();
      this.publish({ status: 'error', durationMs: 0, error });
      return false;
    }
  }

  stop(fileName = 'recorded-voice'): Promise<RecordedAudioFile> {
    this.assertActive();
    if (this.snapshot.status !== 'recording' || !this.recorder) {
      return Promise.reject(new Error('No active voice recording exists.'));
    }
    this.publish({ ...this.snapshot, status: 'stopping' });
    return new Promise((resolve, reject) => {
      this.pendingStop = { resolve, reject };
      this.pendingFileName = fileName;
      try { this.recorder!.stop(); }
      catch (error) {
        this.pendingStop = undefined;
        this.pendingFileName = undefined;
        this.fail(error, this.operationGeneration);
        reject(error);
      }
    });
  }

  cancel(): boolean {
    if (!['recording', 'requesting-permission', 'stopping'].includes(this.snapshot.status)) return false;
    ++this.operationGeneration;
    const pending = this.pendingStop;
    this.pendingStop = undefined;
    this.pendingFileName = undefined;
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch { /* tracks are still released below */ }
    this.releaseStream();
    this.recorder = undefined;
    this.chunks = [];
    pending?.reject(new Error('Voice recording was cancelled.'));
    this.publish({ status: 'idle', durationMs: 0 });
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    ++this.operationGeneration;
    this.disposed = true;
    this.listeners.clear();
    this.releaseStream();
  }

  private completeStop(mimeType: string, generation: number): void {
    if (this.disposed || generation !== this.operationGeneration) return;
    this.releaseStream();
    this.recorder = undefined;
    const durationMs = Math.max(0, this.now() - this.startedAt);
    const blob = new Blob(this.chunks, { type: mimeType });
    this.chunks = [];
    const file = this.createFile(blob, this.pendingFileName ?? 'recorded-voice');
    this.pendingFileName = undefined;
    this.publish({ status: 'recorded', durationMs, mimeType });
    const pending = this.pendingStop;
    this.pendingStop = undefined;
    pending?.resolve(Object.freeze({ blob, file, mimeType, durationMs }));
  }

  private fail(error: unknown, generation: number): void {
    if (this.disposed || generation !== this.operationGeneration) return;
    this.releaseStream();
    this.recorder = undefined;
    this.chunks = [];
    const pending = this.pendingStop;
    this.pendingStop = undefined;
    this.pendingFileName = undefined;
    this.publish({ status: 'error', durationMs: Math.max(0, this.now() - this.startedAt), error });
    pending?.reject(error);
  }
  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
  private publish(state: VoiceRecordingSnapshot): void {
    this.snapshot = Object.freeze({ ...state });
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }
  private assertActive(): void {
    if (this.disposed) throw new Error('The voice recorder has been disposed.');
  }
}

/** Matches the archived SaveVoteService filename convention for voice TUS uploads. */
export function createLegacyVoiceUploadFile(blob: Blob, pollUniqueId: string): File {
  if (!pollUniqueId.trim()) throw new Error('pollUniqueId is required to name a voice recording.');
  return new File([blob], 'recorded_voice_' + pollUniqueId + '.ogg', {
    type: blob.type || 'audio/ogg',
  });
}
