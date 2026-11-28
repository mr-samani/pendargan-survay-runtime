import type { AnswerValue } from '../state/answer-state.types';
import type { FileUploadState } from './file-upload-runtime';

export type FileAnswerValue = Readonly<Record<string, AnswerValue>>;

/**
 * Converts a successfully uploaded file into the archived FileUpload/VoiceRecord
 * answer shape consumed by question-answer-serializer and answer restoration.
 */
export function toFileAnswerValue(state: FileUploadState): FileAnswerValue {
  if (state.status !== 'succeeded' || !state.result?.fileUniqueId) {
    throw new Error('Only a completed upload with a server fileUniqueId can become an answer.');
  }

  const numericId = Number(state.result.fileId);
  const fileId = /^\d+$/.test(state.result.fileId) && Number.isSafeInteger(numericId)
    ? numericId
    : undefined;
  const image = /^(png|jpe?g|gif|webp|bmp|svg)$/i.test(state.extension) || state.fileType.startsWith('image/');
  const video = /^(mp4|webm|mov|avi|mkv)$/i.test(state.extension) || state.fileType.startsWith('video/');

  return Object.freeze({
    ...(fileId !== undefined ? { fileId } : {}),
    fileUniqueId: state.result.fileUniqueId,
    name: state.fileName,
    size: state.size,
    humanSize: humanFileSize(state.size),
    ext: state.extension,
    fileType: state.fileType,
    isImage: image,
    isVideo: video,
    addressUrl: state.result.addressUrl ?? '',
    progress: 100,
  });
}

/** Adds or replaces one uploaded file without mutating the current answer array. */
export function appendFileAnswer(
  current: AnswerValue,
  uploaded: FileUploadState,
): readonly FileAnswerValue[] {
  const item = toFileAnswerValue(uploaded);
  if (current !== null && !Array.isArray(current)) throw new Error('A file answer must be an array.');
  const files = (current ?? []) as readonly AnswerValue[];
  const index = files.findIndex((value) => fileUniqueIdOf(value) === item['fileUniqueId']);
  if (index < 0) return Object.freeze([...files, item as unknown as AnswerValue]) as readonly FileAnswerValue[];
  const next = [...files];
  next[index] = item as unknown as AnswerValue;
  return Object.freeze(next) as readonly FileAnswerValue[];
}

/** Removes a file by its server identity; an unknown ID is a no-op. */
export function removeFileAnswer(current: AnswerValue, fileUniqueId: string): readonly AnswerValue[] {
  if (current === null) return Object.freeze([]);
  if (!Array.isArray(current)) throw new Error('A file answer must be an array.');
  return Object.freeze(current.filter((value) => fileUniqueIdOf(value) !== fileUniqueId));
}

function fileUniqueIdOf(value: AnswerValue): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, AnswerValue>>;
  return typeof record['fileUniqueId'] === 'string' ? record['fileUniqueId'] as string : undefined;
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return size.toFixed(size >= 10 ? 0 : 1) + ' ' + units[unit];
}
