export class GetFilesInputDto {
  pollUniqueId?: string;
  trackingCode?: string;
  pollId?: number;
}

export interface FileData {
  pollUniqueId: string;
  pollTitle: string | null;
  size: number;
  sizeByte: number;
  fileName: string;
  fileState: number;
  fileStateColor?: FileStateColor;
  fileStateTranslatedString: string;
  serverVoterId: number | null;
  addressFromDisk: string;
  addressUrl: string;
  isImage?: boolean;
  isVideo?: boolean;

  errorTranslatedString?: string | null;
  extension?: string;
  voterGuid?: string;
  voterSequentialUniqueId?: string;
  tokenStatus?: string;
  voterLoopIndex?: number;
  htmlResponseContent?: string | null;
  httpStatusCode?: number | null;
  tokenExpireTime?: string | null;
  hasToken?: boolean;
  queueState?: number;
  uniqueId?: string;

  canRetry?: boolean;
}

export interface FileStateColor {
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  isKnownColor?: boolean;
  isEmpty?: boolean;
  isNamedColor?: boolean;
  isSystemColor?: boolean;
  name?: string;
}
