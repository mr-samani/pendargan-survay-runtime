import { BehaviorSubject } from 'rxjs';
import { RecordResult } from './models/RecordResult';
import { RecordVoiceParameter } from './models/RecordVoiceParameter';

export interface IVoiceRecordService {
  recordingSubject: BehaviorSubject<boolean>;
  recordResult?: RecordResult;
  recording: boolean;

  start(params: RecordVoiceParameter): Promise<boolean>;

  stop(params: RecordVoiceParameter): Promise<RecordResult>;
}
