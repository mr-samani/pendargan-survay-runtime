import { describe, expect, it, vi } from 'vitest';
import {
  BrowserVoiceRecorder, createLegacyVoiceUploadFile, queueRecordedVoiceUpload,
  type MediaRecorderFactory, type MediaRecorderLike, type MediaStreamLike,
} from './browser-voice-recorder';
import { FileUploadRuntime, type FileUploadCallbacks, type FileUploadTask, type FileUploadTransport, type TusFileUploadOptions } from './file-upload-runtime';

class FakeRecorder implements MediaRecorderLike {
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  start = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio']) }); this.onstop?.(); });
}
function setup(permission?: Promise<MediaStreamLike>) {
  const recorder = new FakeRecorder();
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const mediaDevices = { getUserMedia: vi.fn(() => permission ?? Promise.resolve(stream)) };
  const factory: MediaRecorderFactory = {
    create: vi.fn(() => recorder),
    isTypeSupported: (type) => type === 'audio/webm;codecs=opus',
  };
  let now = 100;
  const voice = new BrowserVoiceRecorder(mediaDevices, factory, () => now, (blob, name) => new File([blob], name, { type: blob.type }));
  return { voice, recorder, mediaDevices, track, advance: (ms: number) => { now += ms; } };
}
class QueueTransport implements FileUploadTransport {
  options?: TusFileUploadOptions;
  createTask(_file: File, options: TusFileUploadOptions, _callbacks: FileUploadCallbacks): FileUploadTask {
    this.options = options;
    return { start: vi.fn(), abort: vi.fn() };
  }
}
describe('BrowserVoiceRecorder', () => {
  it('records browser audio, returns a File and releases microphone tracks', async () => {
    const { voice, recorder, track, advance } = setup();
    expect(await voice.start()).toBe(true);
    expect(voice.getState().status).toBe('recording');
    advance(1250);
    const result = await voice.stop('answer.ogg');
    expect(recorder.start).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(result.file.name).toBe('answer.ogg');
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.durationMs).toBe(1250);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(voice.getState().status).toBe('recorded');
    voice.dispose();
  });
  it('returns false and exposes permission errors', async () => {
    const { voice } = setup(Promise.reject(new Error('permission denied')));
    expect(await voice.start()).toBe(false);
    expect(voice.getState().status).toBe('error');
    expect(voice.getState().error).toBeInstanceOf(Error);
    voice.dispose();
  });
  it('prevents duplicate starts', async () => {
    const { voice, mediaDevices } = setup();
    expect(await voice.start()).toBe(true);
    expect(await voice.start()).toBe(false);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    voice.dispose();
  });
  it('cancels recording and releases microphone tracks', async () => {
    const { voice, track } = setup();
    await voice.start();
    expect(voice.cancel()).toBe(true);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(voice.getState().status).toBe('idle');
    voice.dispose();
  });
  it('does not start recording when permission resolves after cancellation', async () => {
    let resolvePermission!: (stream: MediaStreamLike) => void;
    const permission = new Promise<MediaStreamLike>((resolve) => { resolvePermission = resolve; });
    const { voice, recorder } = setup(permission);
    const starting = voice.start();
    expect(voice.cancel()).toBe(true);
    const track = { stop: vi.fn() };
    resolvePermission({ getTracks: () => [track] });
    expect(await starting).toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(recorder.start).not.toHaveBeenCalled();
    voice.dispose();
  });
  it('does not turn a recorder error into a successful result after a late stop event', async () => {
    const { voice, recorder } = setup();
    await voice.start();
    recorder.stop.mockImplementation(() => { recorder.state = 'inactive'; });
    const result = voice.stop();
    const failure = new Error('device disconnected');
    recorder.onerror?.(failure);
    recorder.onstop?.();
    await expect(result).rejects.toBe(failure);
    expect(voice.getState().status).toBe('error');
    voice.dispose();
  });
  it('handles unsupported audio formats', async () => {
    const unsupported = new BrowserVoiceRecorder(
      { getUserMedia: vi.fn() },
      { create: vi.fn(), isTypeSupported: () => false },
    );
    expect(await unsupported.start()).toBe(false);
    expect(unsupported.getState().status).toBe('error');
    unsupported.dispose();
  });
  it('uses the archived voice-upload filename convention', () => {
    const file = createLegacyVoiceUploadFile(new Blob(['voice'], { type: 'audio/webm' }), 'poll-42');
    expect(file.name).toBe('recorded_voice_poll-42.ogg');
    expect(file.type).toBe('audio/webm');
    expect(() => createLegacyVoiceUploadFile(new Blob(), ' ')).toThrow();
  });
  it('queues recorded voice through the shared file-upload runtime and token metadata', () => {
    const transport = new QueueTransport();
    const runtime = new FileUploadRuntime(transport, { endpoint: '/FileStorage_CDN', createUploadId: () => 'voice-1' });
    const state = queueRecordedVoiceUpload(runtime, {
      blob: new Blob(['voice'], { type: 'audio/webm' }),
      file: new File(['voice'], 'tmp.webm'),
      mimeType: 'audio/webm',
      durationMs: 1200,
    }, 'poll-42', {
      formGuid: 'form-guid', pollUniqueId: 'poll-42', idCode: '123', formUniqueId: 'form-unique',
    }, { uniqueId: 'voice-token' });
    expect(state.fileName).toBe('recorded_voice_poll-42.ogg');
    expect(state.status).toBe('ready');
    expect(runtime.start(state.uploadId)).toBe(true);
    expect(transport.options).toMatchObject({
      headers: { fileToken: 'voice-token' },
      metadata: { name: 'recorded_voice_poll-42.ogg', formGuid: 'form-guid', pollUniqueId: 'poll-42' },
    });
    runtime.dispose();
  });
});
