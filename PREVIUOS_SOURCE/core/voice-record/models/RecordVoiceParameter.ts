import { FileTokenDataDto } from '@core/models/backend-dto/FileTokenDto';
import { FormChecksumDto } from '@core/models/backend-dto/FormChecksumDto';

export interface RecordVoiceParameter {
  pollUniqueId?: string;
  formGuid?: string;
  formChecksum?: FormChecksumDto;

  /** Reset record data on start  */
  resetRecordedData?: boolean;

  voiceRecordToken?: FileTokenDataDto;
  unexpectedlyClosedId?: string;
}
