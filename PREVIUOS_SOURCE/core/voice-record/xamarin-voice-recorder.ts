import { IVoiceRecordService } from './voice-record.interface';
import { RecordedDeviceEnum } from './models/RecordedDeviceEnum';
import { RecordResult } from './models/RecordResult';
import { Injectable } from '@angular/core';
import { MainSpinnerService } from '@app/main-spinner.service';
import { DataService } from '@core/services/data-service.service';
import { AppConsts } from '@core/app-consts';
import { BehaviorSubject, finalize } from 'rxjs';
import { RecordVoiceParameter } from './models/RecordVoiceParameter';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { TranslateService } from '@ngx-translate/core';

export class VoiceRecordOutputDto {
  recordingStatus!: number;
  simpleResult!: boolean;
  guid?: string;
  fullFilePath!: string;
  fileIdUnique?: string;
}
export class VoiceRecordInputDto {
  voiceRecordTypeEnum!: number;
  requestType!: number;
  guid?: string;
  fullFilePath!: string;
  fileSettingUniqueId?: string;
  valueUniqueId?: string;
  fileIdUnique?: string;
  pollUniqueId?: string;
  unexpectedlyClosedId?: string;
}

@Injectable()
export class XamarinVoiceRecorder implements IVoiceRecordService {
  recording = false;
  recordingSubject = new BehaviorSubject(false);
  voiceRecordOutputDto = new VoiceRecordOutputDto();
  recordResult?: RecordResult;
  fileIdUnique?: string;
  constructor(
    private mainSpinnerService: MainSpinnerService,
    private dataService: DataService,
    private alert: NgxAlertModalService,
    private translate: TranslateService,
  ) {}
  /**
   * به برنامه زامارین اطلاع داده می شود که باید ضبط صدا را شروع کند.
   * نیاز به دریافت فایل ضبط شده نیست
   * فایل ضبط شده در برنامه زامارین باقی می ماند
   */
  start(params: RecordVoiceParameter) {
    return new Promise<boolean>((resolve, reject) => {
      const voiceRecordInputDto = new VoiceRecordInputDto();
      voiceRecordInputDto.voiceRecordTypeEnum = 51; // form
      voiceRecordInputDto.requestType = 1; // StartRequest
      voiceRecordInputDto.guid = params.formGuid;
      voiceRecordInputDto.fullFilePath = '';
      voiceRecordInputDto.fileSettingUniqueId = params.voiceRecordToken?.fileSettingUniqueId;
      voiceRecordInputDto.valueUniqueId = params.voiceRecordToken?.valueUniqueId;
      voiceRecordInputDto.pollUniqueId = params.pollUniqueId;
      voiceRecordInputDto.unexpectedlyClosedId = params.unexpectedlyClosedId;

      this.mainSpinnerService.showLoading = true;
      this.dataService
        .post<VoiceRecordOutputDto>(AppConsts.hybridUrl + AppConsts.pwaUrls.startPwaVoiceRecorder, voiceRecordInputDto)
        .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
        .subscribe({
          next: (resp) => {
            this.voiceRecordOutputDto = resp.result;
            this.recording = resp.result.simpleResult;
            this.fileIdUnique = resp.result.fileIdUnique;
            this.recordingSubject.next(resp.result.simpleResult);
            if (!resp.result.simpleResult) {
              this.alert.show({
                title: this.translate.instant('ErrorOnStartRecordVoiceInApp'),
                confirmButtonText: this.translate.instant('Ok'),
              });
            }

            // this.recording = true;
            console.log('xamarin start voice record', resp);
            resolve(true);
          },
          error: (error) => {
            this.alert.show({
              title: this.translate.instant('ErrorOnStartRecordVoiceInApp'),
              confirmButtonText: this.translate.instant('Ok'),
            });
            this.recording = false;
            this.recordingSubject.next(false);
            console.log('xamarin start voice record', error);
            reject(error);
          },
        });
    });
  }

  stop(params: RecordVoiceParameter): Promise<RecordResult> {
    return new Promise((resolve, reject): void => {
      const voiceRecordInputDto = new VoiceRecordInputDto();
      voiceRecordInputDto.voiceRecordTypeEnum = 51; // form
      voiceRecordInputDto.requestType = 2; // StopRequest
      voiceRecordInputDto.guid = params.formGuid;
      voiceRecordInputDto.fullFilePath = this.voiceRecordOutputDto.fullFilePath;
      voiceRecordInputDto.fileSettingUniqueId = params.voiceRecordToken?.fileSettingUniqueId;
      voiceRecordInputDto.valueUniqueId = params.voiceRecordToken?.valueUniqueId;
      voiceRecordInputDto.fileIdUnique = this.fileIdUnique;
      voiceRecordInputDto.pollUniqueId = params.pollUniqueId;
      this.mainSpinnerService.showLoading = true;
      this.dataService
        .post<VoiceRecordOutputDto>(AppConsts.hybridUrl + AppConsts.pwaUrls.stopPwaVoiceRecorder, voiceRecordInputDto)
        .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
        .subscribe({
          next: (resp) => {
            this.voiceRecordOutputDto = resp.result;
            this.recording = resp.result.simpleResult;
            this.recordingSubject.next(resp.result.simpleResult);
            console.log('xamarin stop voice record successfully', resp);
            resolve({
              audioBlob: '',
              audioUrl: '',
              base64data: '',
              type: RecordedDeviceEnum.Xamarin,
              fileIdUnique: resp.result.fileIdUnique,
            });
          },
          error: (error) => {
            this.recording = false;
            this.recordingSubject.next(false);
            console.log('xamarin stop voice record with error', error);
          },
        });
    });
  }
}
