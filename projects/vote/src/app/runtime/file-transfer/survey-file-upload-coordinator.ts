import type { AnswerValue } from '../state/answer-state.types';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import {
  FileUploadRuntime,
  type FileUploadContext,
  type FileUploadState,
  type FileUploadToken,
} from './file-upload-runtime';
import { appendFileAnswer, type FileAnswerValue } from './file-upload-answer.adapter';
import {
  createLegacyVoiceUploadFile,
  type RecordedAudioFile,
} from './browser-voice-recorder';

export type FileUploadRejectionCode =
  | 'QUESTION_NOT_FOUND'
  | 'FILE_EXTENSION_NOT_ALLOWED'
  | 'FILE_SIZE_ABOVE_MAXIMUM'
  | 'FILE_SIZE_BELOW_MINIMUM'
  | 'FILE_COUNT_ABOVE_MAXIMUM';

export class FileUploadRejectedError extends Error {
  constructor(readonly code: FileUploadRejectionCode, message: string) {
    super(message);
    this.name = 'FileUploadRejectedError';
  }
}

interface FileSettingSnapshot {
  readonly extension?: string | null;
  readonly minFileCount?: number | null;
  readonly maxFileCount?: number | null;
  readonly minSize?: number | null;
  readonly maxSize?: number | null;
}

interface QuestionUploadEntry {
  readonly questionId: string;
  readonly tokenIndex: number;
}

/**
 * Joins the immutable survey definition (including server-issued file tokens)
 * to the shared TUS runtime and canonical file-answer adapter.
 *
 * It intentionally does not render UI or mutate answer state. The caller
 * receives upload snapshots and applies completed answer arrays through the
 * normal runtime answer-command boundary.
 */
export class SurveyFileUploadCoordinator {
  private readonly questions = new Map<string, SurveyQuestionDefinition>();
  private readonly uploadEntries = new Map<string, QuestionUploadEntry>();
  private readonly nextTokenIndexByQuestion = new Map<string, number>();
  private disposed = false;

  constructor(
    private readonly definition: SurveyDefinition,
    private readonly runtime: FileUploadRuntime,
    private readonly context: FileUploadContext,
  ) {
    for (const question of definition.questions) this.questions.set(question.id, question);
  }

  upload(
    questionId: string,
    file: File,
    currentAnswer: AnswerValue = null,
  ): FileUploadState {
    this.assertActive();
    const question = this.questions.get(questionId);
    if (!question) {
      throw new FileUploadRejectedError('QUESTION_NOT_FOUND', 'The file question does not exist in this survey.');
    }

    const answer = normalizeFileAnswer(currentAnswer);
    const setting = readFileSetting(question);
    this.validateFile(question, file, setting, answer);

    const tokenIndex = this.reserveTokenIndex(questionId, answer.length);
    const token = readFileToken(question, tokenIndex);
    const state = this.runtime.add(file, this.context, token);
    this.uploadEntries.set(state.uploadId, { questionId, tokenIndex });

    if (!this.runtime.start(state.uploadId)) {
      this.uploadEntries.delete(state.uploadId);
      this.runtime.remove(state.uploadId);
      throw new Error('The upload could not be started.');
    }
    return this.runtime.getState(state.uploadId) ?? state;
  }

  retry(uploadId: string): boolean {
    this.assertActive();
    return this.uploadEntries.has(uploadId) && this.runtime.retry(uploadId);
  }

  cancel(uploadId: string): boolean {
    this.assertActive();
    return this.uploadEntries.has(uploadId) && this.runtime.cancel(uploadId);
  }

  remove(uploadId: string): boolean {
    this.assertActive();
    if (!this.uploadEntries.has(uploadId)) return false;
    const state = this.runtime.getState(uploadId);
    if (!state || ['uploading', 'retrying'].includes(state.status)) return false;
    this.uploadEntries.delete(uploadId);
    return this.runtime.remove(uploadId);
  }

  getState(uploadId: string): FileUploadState | undefined {
    return this.runtime.getState(uploadId);
  }

  getQuestionStates(questionId: string): readonly FileUploadState[] {
    return Object.freeze([...this.uploadEntries.entries()]
      .filter(([, entry]) => entry.questionId === questionId)
      .map(([uploadId]) => this.runtime.getState(uploadId))
      .filter((state): state is FileUploadState => state !== undefined));
  }

  /**
   * Merges successful uploads for this question into the caller's current
   * answer. Server fileUniqueId is the identity, so repeated calls are safe.
   */
  buildAnswer(questionId: string, currentAnswer: AnswerValue = null): readonly FileAnswerValue[] {
    this.assertActive();
    let answer = normalizeFileAnswer(currentAnswer);
    for (const state of this.getQuestionStates(questionId)) {
      if (state.status === 'succeeded') {
        answer = appendFileAnswer(answer as unknown as AnswerValue, state) as readonly FileAnswerValue[];
      }
    }
    return answer;
  }

  /** Queues recorded browser audio through the same TUS metadata/token path. */
  uploadVoice(
    recording: RecordedAudioFile,
    voiceToken?: FileUploadToken | null,
  ): FileUploadState {
    this.assertActive();
    const file = createLegacyVoiceUploadFile(recording.blob, this.context.pollUniqueId);
    const state = this.runtime.add(file, this.context, voiceToken);
    this.uploadEntries.set(state.uploadId, { questionId: '__voice__', tokenIndex: 0 });
    if (!this.runtime.start(state.uploadId)) {
      this.uploadEntries.delete(state.uploadId);
      this.runtime.remove(state.uploadId);
      throw new Error('The voice upload could not be started.');
    }
    return this.runtime.getState(state.uploadId) ?? state;
  }

  getVoiceStates(): readonly FileUploadState[] {
    return this.getQuestionStates('__voice__');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.uploadEntries.clear();
    this.nextTokenIndexByQuestion.clear();
    this.runtime.dispose();
  }

  private validateFile(
    question: SurveyQuestionDefinition,
    file: File,
    setting: FileSettingSnapshot,
    currentAnswer: readonly AnswerValue[],
  ): void {
    if (!file || typeof file.name !== 'string') throw new TypeError('A browser File is required.');
    const extension = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '';
    const allowed = parseExtensions(setting.extension);
    if (allowed.length > 0 && !allowed.includes(extension)) {
      throw new FileUploadRejectedError('FILE_EXTENSION_NOT_ALLOWED', 'The selected file extension is not allowed.');
    }

    const sizeKb = Math.round(file.size / 1024);
    if (setting.maxSize && sizeKb > setting.maxSize) {
      throw new FileUploadRejectedError('FILE_SIZE_ABOVE_MAXIMUM', 'The selected file exceeds the maximum size.');
    }
    if (setting.minSize && sizeKb < setting.minSize) {
      throw new FileUploadRejectedError('FILE_SIZE_BELOW_MINIMUM', 'The selected file is smaller than the minimum size.');
    }

    const existingIds = new Set(currentAnswer.map(fileIdentity).filter((id): id is string => !!id));
    let effectiveCount = currentAnswer.length;
    for (const state of this.getQuestionStates(question.id)) {
      if (state.status === 'cancelled' || state.status === 'failed') continue;
      const serverId = state.result?.fileUniqueId;
      if (serverId && existingIds.has(serverId)) continue;
      effectiveCount++;
      if (serverId) existingIds.add(serverId);
    }
    const maxCount = setting.maxFileCount;
    if (maxCount != null && effectiveCount + 1 > maxCount) {
      throw new FileUploadRejectedError('FILE_COUNT_ABOVE_MAXIMUM', 'The maximum number of files has been reached.');
    }
  }

  private reserveTokenIndex(questionId: string, existingCount: number): number {
    const index = Math.max(this.nextTokenIndexByQuestion.get(questionId) ?? 0, existingCount);
    this.nextTokenIndexByQuestion.set(questionId, index + 1);
    return index;
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('The file upload coordinator has been disposed.');
  }
}

function readFileSetting(question: SurveyQuestionDefinition): FileSettingSnapshot {
  const value = question.source['fileUploadSettingDto'];
  return value && typeof value === 'object' ? value as FileSettingSnapshot : {};
}

function readFileToken(question: SurveyQuestionDefinition, index: number): FileUploadToken | undefined {
  const values = question.source['formQuestionFileUploadTokenDtos'];
  if (!Array.isArray(values)) return undefined;
  const token = values[index];
  if (!token || typeof token !== 'object') return undefined;
  const uniqueId = (token as { uniqueId?: unknown }).uniqueId;
  return typeof uniqueId === 'string' && uniqueId ? { uniqueId } : undefined;
}

function parseExtensions(value: string | null | undefined): readonly string[] {
  if (!value) return [];
  return Object.freeze(value.split(/،|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => item.startsWith('.') ? item : '.' + item));
}

function normalizeFileAnswer(value: AnswerValue): readonly AnswerValue[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('A file question answer must be an array.');
  return value;
}

function fileIdentity(value: AnswerValue): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const id = (value as Readonly<Record<string, AnswerValue>>)['fileUniqueId'];
  return typeof id === 'string' ? id : undefined;
}
