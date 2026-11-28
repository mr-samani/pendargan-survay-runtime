import { Injectable } from '@angular/core';
import { IVoiceRecordService } from './voice-record.interface';
import { RecordedDeviceEnum } from './models/RecordedDeviceEnum';
import { RecordResult } from './models/RecordResult';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { RecordVoiceParameter } from './models/RecordVoiceParameter';
declare var appCommand: any;

@Injectable()
export class KBrowserVoiceRecorder implements IVoiceRecordService {
  recordingSubject = new BehaviorSubject(false);
  recordResult?: RecordResult;
  recording = false;

  constructor(
    private translateService: TranslateService,
    private alert: NgxAlertModalService,
  ) {}

  start(params: RecordVoiceParameter) {
    return new Promise<boolean>((resolve, reject) => {
      try {
        if (window.navigator.userAgent.includes('KBrowser 0.8')) {
          this.startRecordVoiceV1(params);
        } else {
          this.startRecordVoiceV2(params);
        }
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(params: RecordVoiceParameter): Promise<RecordResult> {
    //  اگر فایل صدا وجود داشت - ممکن است ارسال فایل به خطا خورده باشد و بخواهد دوباره ارسال کند
    if (this.recordResult) {
      return new Promise((resolve, reject): void => {
        return resolve(this.recordResult!);
      });
    } else if (window.navigator.userAgent.includes('KBrowser 0.8')) {
      return this.stopRecordingV1(params);
    } else {
      return this.stopRecordingV2(params);
    }
  }

  /**
   * شروع ضبط صدا با kbrowser
   */
  private async startRecordVoiceV1(params: RecordVoiceParameter): Promise<void> {
    if (typeof appCommand === 'object') {
      if (appCommand.enableTimeCheck !== undefined) {
        if (params.formChecksum?.forceCorrectTime) {
          appCommand.enableTimeCheck();
        }
        appCommand.logPollOpen(
          params.pollUniqueId,
          params.formChecksum?.userName,
          params.formChecksum?.userUniqueId,
          params.formGuid,
          params.formChecksum?.serverTime,
        );
        const startKB = appCommand.start(params.formGuid, '', '', params.formChecksum?.forceCheck);
        if (!startKB) {
          this.handleError(params, this.translateService.instant('KBrowserErrorStart'));
        } else {
          this.recording = true;
          this.recordingSubject.next(true);

          // alert('در حال ضبط صدا...');
        }
      } else {
        if (!appCommand.start(params.formGuid)) {
          this.handleError(params, this.translateService.instant('KBrowserErrorStart'));
        } else {
          this.recording = true;
          this.recordingSubject.next(true);

          //  alert('در حال ضبط صدا...');
        }
      }
    } else {
      this.handleError(params, this.translateService.instant('KBrowserErrorUndefined'));
    }
  }
  private async startRecordVoiceV2(params: RecordVoiceParameter): Promise<void> {
    if (typeof appCommand === 'object') {
      if (appCommand.enableTimeCheck !== undefined) {
        if (params.formChecksum?.forceCorrectTime) {
          appCommand.enableTimeCheck();
        }
        appCommand.logPollOpen(
          params.pollUniqueId,
          params.formChecksum?.userName,
          params.formChecksum?.userUniqueId,
          params.formGuid,
          params.formChecksum?.serverTime,
        );
        await appCommand.start(params.formGuid, '', '', params.formChecksum?.forceCheck).then((startKB: boolean) => {
          if (!startKB) {
            this.handleError(params, this.translateService.instant('KBrowserErrorStart'));
          } else {
            this.recording = true;
            this.recordingSubject.next(true);
          }
        });
      } else {
        await appCommand.start(params.formGuid).then((r: boolean) => {
          if (r) {
            this.handleError(params, this.translateService.instant('KBrowserErrorStart'));
          } else {
            this.recording = true;
            this.recordingSubject.next(true);
          }
        });
      }
    } else {
      this.handleError(params, this.translateService.instant('KBrowserErrorUndefined'));
    }
  }

  private handleError(params: RecordVoiceParameter, errorMsg: string): void {
    this.alert
      .show({
        title: this.translateService.instant('ErrorStartKBrowserRecordVoice'),
        html: errorMsg,
        showCancelButton: false,
        allowEnterKey: true,
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonText: this.translateService.instant('Ok'),
      })
      .then((result) => {
        if (window.navigator.userAgent.includes('KBrowser 0.8')) {
          this.startRecordVoiceV1(params);
        } else {
          this.startRecordVoiceV2(params);
        }
      });
  }

  /*---------------------------------------------------------------*/
  private stopRecordingV1(params: RecordVoiceParameter): Promise<RecordResult> {
    return new Promise(async (resolve, reject): Promise<void> => {
      try {
        let fileData = '';
        if (appCommand.logPollSubmitAttempt !== undefined) {
          appCommand.logPollSubmitAttempt(
            params.pollUniqueId,
            params.formChecksum?.userName,
            params.formChecksum?.userUniqueId,
            params.formGuid,
          );
          fileData = appCommand.stop(params.formGuid, '', '', params.formChecksum?.forceCheck);
        } else {
          fileData = appCommand.stop(params.formGuid);
        }
        this.recordResult = {
          audioBlob: this.convertAudioBase64ToBlob(fileData),
          audioUrl: '',
          base64data: '',
          type: RecordedDeviceEnum.KBrowser,
        };
        resolve(this.recordResult);
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }
  private stopRecordingV2(params: RecordVoiceParameter): Promise<RecordResult> {
    return new Promise(async (resolve, reject): Promise<void> => {
      try {
        if (appCommand.logPollSubmitAttempt !== undefined) {
          appCommand.logPollSubmitAttempt(
            params.pollUniqueId,
            params.formChecksum?.userName,
            params.formChecksum?.userUniqueId,
            params.formGuid,
          );
          await appCommand.stop(params.formGuid, '', '', params.formChecksum?.forceCheck).then((fileData: any) => {
            this.recordResult = {
              audioBlob: this.convertAudioBase64ToBlob(fileData),
              audioUrl: '',
              base64data: '',
              type: RecordedDeviceEnum.KBrowser,
            };
            resolve(this.recordResult);
          });
        } else {
          await appCommand.stop(params.formGuid).then((fileData: any) => {
            this.recordResult = {
              audioBlob: this.convertAudioBase64ToBlob(fileData),
              audioUrl: '',
              base64data: '',
              type: RecordedDeviceEnum.KBrowser,
            };
            resolve(this.recordResult);
          });
        }
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }

  private convertAudioBase64ToBlob(base64String: string): Blob {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/ogg' });
    return blob;
  }
}
