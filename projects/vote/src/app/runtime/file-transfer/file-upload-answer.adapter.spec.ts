import { describe, expect, it } from 'vitest';
import type { FileUploadState } from './file-upload-runtime';
import { appendFileAnswer, removeFileAnswer, toFileAnswerValue } from './file-upload-answer.adapter';

function uploaded(overrides: Partial<FileUploadState> = {}): FileUploadState {
  return Object.freeze({
    uploadId: 'upload-1',
    fileName: 'photo.JPG',
    extension: 'jpg',
    fileType: 'image/jpeg',
    size: 2048,
    status: 'succeeded',
    progress: 100,
    uploadedBytes: 2048,
    totalBytes: 2048,
    result: { fileId: '42', fileUniqueId: 'server-file-42', addressUrl: '/files/42' },
    ...overrides,
  });
}
describe('file upload answer adapter', () => {
  it('maps a successful upload to the archived answer shape and safe numeric file ID', () => {
    expect(toFileAnswerValue(uploaded())).toEqual({
      fileId: 42,
      fileUniqueId: 'server-file-42',
      name: 'photo.JPG',
      size: 2048,
      humanSize: '2.0 KB',
      ext: 'jpg',
      fileType: 'image/jpeg',
      isImage: true,
      isVideo: false,
      addressUrl: '/files/42',
      progress: 100,
    });
  });

  it('omits non-numeric or unsafe server file IDs without losing the unique ID', () => {
    const value = toFileAnswerValue(uploaded({
      result: { fileId: '9007199254740992', fileUniqueId: 'unique' },
    }));
    expect(value).not.toHaveProperty('fileId');
    expect(value['fileUniqueId']).toBe('unique');
  });

  it('rejects pending, failed or incomplete uploads', () => {
    expect(() => toFileAnswerValue(uploaded({ status: 'uploading' }))).toThrow();
    expect(() => toFileAnswerValue(uploaded({ result: undefined }))).toThrow();
  });

  it('appends immutably and replaces a file with the same server identity', () => {
    const first = uploaded();
    const original = [toFileAnswerValue(first)];
    const replaced = appendFileAnswer(original as never, uploaded({
      fileName: 'renamed.jpg',
      result: { fileId: '43', fileUniqueId: 'server-file-42', addressUrl: '/files/43' },
    }));
    expect(original[0]['name']).toBe('photo.JPG');
    expect(replaced).toHaveLength(1);
    expect(replaced[0]['name']).toBe('renamed.jpg');
    expect(replaced[0]['fileId']).toBe(43);
  });

  it('appends a new server file and removes only the requested identity', () => {
    const one = appendFileAnswer(null, uploaded());
    const two = appendFileAnswer(one as never, uploaded({
      uploadId: 'upload-2',
      fileName: 'clip.mp4',
      extension: 'mp4',
      fileType: 'video/mp4',
      result: { fileId: '44', fileUniqueId: 'server-file-44' },
    }));
    expect(two).toHaveLength(2);
    expect(two[1]['isVideo']).toBe(true);
    expect(removeFileAnswer(two as never, 'server-file-42')).toHaveLength(1);
    expect(removeFileAnswer(two as never, 'missing')).toHaveLength(2);
  });

  it('rejects non-array answer values', () => {
    expect(() => appendFileAnswer('invalid', uploaded())).toThrow();
    expect(() => removeFileAnswer('invalid', 'id')).toThrow();
  });
});
