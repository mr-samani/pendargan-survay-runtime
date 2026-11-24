import { FileStateEnum } from '../file-upload-pwa/file-upload-pwa.model';

export class FileModel {
  ext!: string;
  name!: string;
  size!: number;
  humanSize!: string;
  fileType!: string;
  data?: string;
  file?: any;
  isImage!: boolean;
  isVideo!: boolean;
  progress!: number;
  status?: UploadStatusEnum;
  // PWA dile state
  fileState?: FileStateEnum;
  fileUniqueId?: string;
  fileId?: number;
  addressUrl?: string;
}

export enum UploadStatusEnum {
  Ready,
  Uploading,
  Success,
  Failed,
  TryingAgain,
}
