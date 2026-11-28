import { RecordedDeviceEnum } from './RecordedDeviceEnum';

export interface RecordResult {
  base64data: any;
  audioBlob: any;
  audioUrl: any;
  type: RecordedDeviceEnum;

  /** only fill in xamarin stop record */
  fileIdUnique?: string;
}
