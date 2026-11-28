import type { AnswerValue } from '../state/answer-state.types';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import {
  FileUploadRuntime,
  type FileUploadContext,
  type FileUploadState,
  type FileUploadToken,
} from './file-upload-runtime';
import { toFileAnswerValue, type FileAnswerValue } from './file-upload-answer.adapter';
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

interface CompiledFileSetting extends FileSettingSnapshot {
  readonly allowedExtensions: readonly string[];
}

interface QuestionUploadEntry {
  readonly questionId: string;
  readonly answerInstanceId: string;
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
export interface FileUploadSubmissionIssue {
  readonly uploadId: string;
  readonly questionId: string;
  readonly fileName: string;
  readonly status: Exclude<FileUploadState['status'], 'succeeded'>;
}

export interface VoiceFileSubmissionReference {
  readonly fileId: number;
  readonly fileUniqueId: string;
}

export class FileUploadSubmissionBlockedError extends Error {
  constructor(readonly issues: readonly FileUploadSubmissionIssue[]) {
    super('File uploads must finish successfully or be removed before submission.');
    this.name = 'FileUploadSubmissionBlockedError';
  }
}

export class SurveyFileUploadCoordinator {
  private readonly questions = new Map<string, SurveyQuestionDefinition>();
  private readonly fileSettings = new Map<string, CompiledFileSetting>();
  private readonly uploadEntries = new Map<string, QuestionUploadEntry>();
  /** Question/instance index keeps progress and answer projection off the global upload list. */
  private readonly uploadIdsByQuestion = new Map<string, Map<string, Set<string>>>();
  private readonly nextTokenIndexByQuestion = new Map<string, number>();
  private disposed = false;

  constructor(
    private readonly definition: SurveyDefinition,
    private readonly runtime: FileUploadRuntime,
    private readonly context: FileUploadContext,
  ) {
    for (const question of definition.questions) {
      this.questions.set(question.id, question);
      const setting = this.fileSettings.get(questionId)!;
      this.fileSettings.set(question.id, Object.freeze({
        ...setting,
        allowedExtensions: parseExtensions(setting.extension),
      }));
    }
  }

  upload(
    questionId: string,
    file: File,
    currentAnswer: AnswerValue = null,
    answerInstanceId = 'root',
  ): FileUploadState {
    this.assertActive();
    const question = this.questions.get(questionId);
    if (!question) {
      throw new FileUploadRejectedError('QUESTION_NOT_FOUND', 'The file question does not exist in this survey.');
    }

    const answer = normalizeFileAnswer(currentAnswer);
    const setting = readFileSetting(question);
    this.validateFile(question, file, setting, answer, answerInstanceId);

    const tokenIndex = this.reserveTokenIndex(questionId, answer.length);
    const token = readFileToken(question, tokenIndex);
    const state = this.runtime.add(file, this.context, token);
    this.addUploadEntry(state.uploadId, { questionId, answerInstanceId, tokenIndex });

    if (!this.runtime.start(state.uploadId)) {
      this.removeUploadEntry(state.uploadId);
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
    this.removeUploadEntry(uploadId);
    return this.runtime.remove(uploadId);
  }

  getState(uploadId: string): FileUploadState | undefined {
    return this.runtime.getState(uploadId);
  }

  subscribe(listener: (state: FileUploadState) => void): () => void {
    this.assertActive();
    return this.runtime.subscribe(listener);
  }

  getQuestionStates(questionId: string, answerInstanceId?: string): readonly FileUploadState[] {
    const byInstance = this.uploadIdsByQuestion.get(questionId);
    if (!byInstance) return Object.freeze([]);
    const states: FileUploadState[] = [];
    const append = (uploadIds: ReadonlySet<string>) => {
      for (const uploadId of uploadIds) {
        const state = this.runtime.getState(uploadId);
        if (state) states.push(state);
      }
    };
    if (answerInstanceId !== undefined) {
      const uploadIds = byInstance.get(answerInstanceId);
      if (uploadIds) append(uploadIds);
    } else {
      for (const uploadIds of byInstance.values()) append(uploadIds);
    }
    return Object.freeze(states);
  }

  /**
   * Merges successful uploads for this question into the caller's current
   * answer. Server fileUniqueId is the identity, so repeated calls are safe.
   */
  buildAnswer(
    questionId: string,
    currentAnswer: AnswerValue = null,
    answerInstanceId?: string,
  ): readonly FileAnswerValue[] {
    this.assertActive();
    const current = normalizeFileAnswer(currentAnswer);
    const answer = [...current] as FileAnswerValue[];
    const indexByFileId = new Map<string, number>();
    for (let index = 0; index < answer.length; index++) {
      const fileId = fileIdentity(answer[index] as unknown as AnswerValue);
      if (fileId && !indexByFileId.has(fileId)) indexByFileId.set(fileId, index);
    }
    for (const state of this.getQuestionStates(questionId, answerInstanceId)) {
      if (state.status !== 'succeeded' || !state.result?.fileUniqueId) continue;
      const item = toFileAnswerValue(state);
      const existingIndex = indexByFileId.get(state.result.fileUniqueId);
      if (existingIndex === undefined) {
        indexByFileId.set(state.result.fileUniqueId, answer.length);
        answer.push(item);
      } else {
        answer[existingIndex] = item;
      }
    }
    return Object.freeze(answer);
  }

  /** Queues recorded browser audio through the same TUS metadata/token path. */
  uploadVoice(
    recording: RecordedAudioFile,
    voiceToken?: FileUploadToken | null,
  ): FileUploadState {
    this.assertActive();
    const file = createLegacyVoiceUploadFile(recording.blob, this.context.pollUniqueId);
    const state = this.runtime.add(file, this.context, voiceToken);
    this.addUploadEntry(state.uploadId, { questionId: '__voice__', answerInstanceId: 'root', tokenIndex: 0 });
    if (!this.runtime.start(state.uploadId)) {
      this.removeUploadEntry(state.uploadId);
      this.runtime.remove(state.uploadId);
      throw new Error('The voice upload could not be started.');
    }
    return this.runtime.getState(state.uploadId) ?? state;
  }

  getVoiceStates(): readonly FileUploadState[] {
    return this.getQuestionStates('__voice__');
  }

  /** Returns every selected upload that is not yet safe to include in a submission. */
  getSubmissionIssues(): readonly FileUploadSubmissionIssue[] {
    this.assertActive();
    const issues: FileUploadSubmissionIssue[] = [];
    for (const [uploadId, entry] of this.uploadEntries) {
      const state = this.runtime.getState(uploadId);
      if (!state || state.status === 'succeeded') continue;
      issues.push(Object.freeze({
        uploadId,
        questionId: entry.questionId,
        fileName: state.fileName,
        status: state.status,
      }));
    }
    return Object.freeze(issues);
  }

  /** Fail closed instead of silently submitting while a file is pending or failed. */
  assertReadyForSubmission(): void {
    const issues = this.getSubmissionIssues();
    if (issues.length > 0) throw new FileUploadSubmissionBlockedError(issues);
  }

  /** Maps the single successful voice upload to the legacy voter-detail metadata. */
  getVoiceSubmissionReference(): VoiceFileSubmissionReference {
    this.assertActive();
    const completed = this.getVoiceStates().filter((state) => state.status === 'succeeded');
    if (completed.length !== 1 || !completed[0].result) {
      throw new Error('Exactly one completed voice upload is required.');
    }
    const fileId = Number(completed[0].result.fileId);
    if (!/^\d+$/.test(completed[0].result.fileId) || !Number.isSafeInteger(fileId)) {
      throw new Error('The voice upload returned an invalid numeric file ID.');
    }
    return Object.freeze({ fileId, fileUniqueId: completed[0].result.fileUniqueId });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.uploadEntries.clear();
    this.uploadIdsByQuestion.clear();
    this.nextTokenIndexByQuestion.clear();
    this.runtime.dispose();
  }

  private validateFile(
    question: SurveyQuestionDefinition,
    file: File,
    setting: CompiledFileSetting,
    currentAnswer: readonly AnswerValue[],
    answerInstanceId: string,
  ): void {
    if (!file || typeof file.name !== 'string') throw new TypeError('A browser File is required.');
    const extension = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '';
    const allowed = setting.allowedExtensions;
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
    for (const state of this.getQuestionStates(question.id, answerInstanceId)) {
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

  private addUploadEntry(uploadId: string, entry: QuestionUploadEntry): void {
    this.uploadEntries.set(uploadId, entry);
    let byInstance = this.uploadIdsByQuestion.get(entry.questionId);
    if (!byInstance) {
      byInstance = new Map();
      this.uploadIdsByQuestion.set(entry.questionId, byInstance);
    }
    let uploadIds = byInstance.get(entry.answerInstanceId);
    if (!uploadIds) {
      uploadIds = new Set();
      byInstance.set(entry.answerInstanceId, uploadIds);
    }
    uploadIds.add(uploadId);
  }

  private removeUploadEntry(uploadId: string): void {
    const entry = this.uploadEntries.get(uploadId);
    if (!entry) return;
    this.uploadEntries.delete(uploadId);
    const byInstance = this.uploadIdsByQuestion.get(entry.questionId);
    const uploadIds = byInstance?.get(entry.answerInstanceId);
    uploadIds?.delete(uploadId);
    if (uploadIds?.size === 0) byInstance?.delete(entry.answerInstanceId);
    if (byInstance?.size === 0) this.uploadIdsByQuestion.delete(entry.questionId);
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

function normalizeFileAnswer(value: AnswerValue): readonly FileAnswerValue[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('A file question answer must be an array.');
  if (value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new TypeError('Every file answer entry must be an object.');
  }
  return value as readonly FileAnswerValue[];
}

function fileIdentity(value: AnswerValue): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const id = (value as Readonly<Record<string, AnswerValue>>)['fileUniqueId'];
  return typeof id === 'string' ? id : undefined;
}
