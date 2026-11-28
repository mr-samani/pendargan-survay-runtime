import { Injectable } from '@angular/core';
import { IVoiceRecordService } from './voice-record.interface';
import { RecordedDeviceEnum } from './models/RecordedDeviceEnum';
import { RecordResult } from './models/RecordResult';
import { BehaviorSubject } from 'rxjs';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { TranslateService } from '@ngx-translate/core';
import { convertBlobToBase64, exportAudioBlob } from './audio-blob';
import { RecordVoiceParameter } from './models/RecordVoiceParameter';

@Injectable()
export class WebVoiceRecorder implements IVoiceRecordService {
  recordingSubject = new BehaviorSubject(false);
  recordResult?: RecordResult;
  recording = false;

  private mediaRecorder?: MediaRecorder;
  private recordedChunks: Blob[] = [];

  constructor(
    private alert: NgxAlertModalService,
    private translateService: TranslateService,
  ) {}

  async start(params: RecordVoiceParameter): Promise<boolean> {
    // check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      await this.showError('CanNotRecordVoice', 'RecordVoice', params);
      return false;
    }
    if (params.resetRecordedData) {
      this.recordedChunks = [];
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recording = true;
      this.recordingSubject.next(true);
      this.recordedChunks = [];
      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        throw new Error('No supported audio formats found.');
      }
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.start();
      console.log('🎙️ Recording started (Ogg)...');
      return true;
    } catch (error: any) {
      this.recording = false;
      this.recordingSubject.next(false);
      console.error('❌ Error starting recording:', error);
      // ❗ check warning type for retry
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        await this.showPermissionHelp(params);
        return false;
      } else {
        await this.showError('CanNotRecordVoice', 'RecordVoice', params);
        return false;
      }
    }
  }

  async stop(): Promise<RecordResult> {
    this.recording = false;
    this.recordingSubject.next(false);
    //  اگر فایل صدا وجود داشت - ممکن است ارسال فایل به خطا خورده باشد و بخواهد دوباره ارسال کند
    if (this.recordResult) {
      return new Promise((resolve, reject): void => {
        return resolve(this.recordResult!);
      });
    } else {
      return new Promise((resolve, reject) => {
        try {
          if (!this.mediaRecorder) return reject('Recorder not initialized.');

          this.mediaRecorder.onstop = async () => {
            const mimeType = this.getSupportedMimeType();
            const blob = new Blob(this.recordedChunks, { type: mimeType! });
            const base64data = await convertBlobToBase64(blob);
            const url = URL.createObjectURL(blob);
            this.recordResult = {
              base64data,
              audioBlob: blob,
              audioUrl: url,
              type: RecordedDeviceEnum.Web,
            };
            resolve(this.recordResult);
          };

          this.recording = false;
          this.recordingSubject.next(false);
          this.mediaRecorder.stop();
          console.log('🛑 Recording stopped (Ogg).');
        } catch (error) {
          console.error('❌ Error stopping recording:', error);
          reject(error);
        }
      });
    }
  }

  private getSupportedMimeType(): string | null {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  }

  // 📌 نمایش خطای ساده
  private async showError(translationKey: string, titleKey: string, params: RecordVoiceParameter): Promise<void> {
    await this.alert
      .show({
        title: this.translateService.instant(titleKey),
        html: '<p>' + this.translateService.instant(translationKey) + '</p>',
        showCancelButton: false,
        allowEnterKey: true,
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonText: this.translateService.instant('Ok'),
      })
      .then((r) => {
        this.start(params);
      });
  }

  // 📌 نمایش راهنمای دسترسی به میکروفون
  private async showPermissionHelp(params: RecordVoiceParameter): Promise<void> {
    await this.alert
      .show({
        title: this.translateService.instant('AccessPermission'),
        html:
          '<p>' +
          this.translateService.instant('PleaseAllowAccessToUseMicrophone') +
          '</p><img width="100%" src="assets/images/allow-record-voice.png" />',
        showCancelButton: false,
        allowEnterKey: true,
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonText: this.translateService.instant('Ok'),
      })
      .then((r) => {
        this.start(params);
      });
  }
}
