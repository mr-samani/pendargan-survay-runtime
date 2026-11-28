export class FormUploadFileDto {
  authCode!: string;
  name!: string;
  formGuid!: string;
  size!: number;
  extension!: string;
  formQuestionUniqueId!: string;
  data!: string;
  minSize?: number;
  maxSize?: number;
  minImageHeight?: number;
  maxImageHeight?: number;
  minImageWidth?: number;
  maxImageWidth?: number;
  contentType?: string;
  minFileCount?: number;
  maxFileCount?: number;
  validationCountdown!: string;
  fileSettingUniqueId?: string;
  keyUniqueId!: string;
  valueUniqueId?: string;
  keyData?: string;
  valueData?: string;
  fileState?: FileStateEnum;
  fileSelectionType?: FileSelectionTypeEnum;
  voterLoopIndexNumber?: number;
  pollUniqueId!: string;
}
export enum FileStateEnum {
  //Upload
  UploadPendingFailed = 101,
  UploadFailed = -102,

  //Download
  DownloadFailed = -220,

  ServerResponseInvalid = -50,

  CorruptedFileHash = -5,
  Deleted = -1,
  OnLocal = 1,

  //Upload
  UploadPending = 101,
  UploadInQueue = 115,
  UploadFinish = 102,

  //Download
  DownloadPending = 100,
  Downloaded = 220,
}

/*---------------------------------------------------------*/

export class FileUploadResponse {
  fileId!: number;
  fileUniqueId!: string;
  fileHash!: string;
  resultCode!: number;
}

export enum FileSelectionTypeEnum {
  SelectFile = 0, //WIP

  PictureCapture = 1,
  PictureSelect = 6,
  PictureCaptureOrSelect = 7, //WIP

  VideoCapture = 2,
  VideoSelect = 8,
  VideoCaptureOrSelect = 10, //WIP

  AudioCapture = 3, //WIP
  AudioSelect = 9, //WIP
  AudioCaptureOrSelect = 11, //WIP
}
