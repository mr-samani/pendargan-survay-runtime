import { InjectionToken } from '@angular/core';
import { IVoiceRecordService } from './voice-record.interface';

export const VOICE_RECORD_SERVICE = new InjectionToken<IVoiceRecordService>('IVoiceRecordService');
