import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import { QuestionModel } from '@core/models/QuestionModel';
import { FileModel, UploadStatusEnum } from '../file-upload/file.model';
import { Upload, UploadOptions, HttpResponse, HttpRequest } from 'tus-js-client';
import { AppConsts } from '@core/app-consts';
import { humanFileSize, isImage, isVideo } from '@core/helper/file.helper';
import { AbstractControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { RecordResult } from '@core/voice-record/models/RecordResult';
import { IVoiceRecordService } from '@core/voice-record/voice-record.interface';
import { WebVoiceRecorder } from '@core/voice-record/web-voice-recorder';
import { ReplaceContentTypeHttpStack } from '@core/helper/ReplaceContentTypeHttpStack';
import { TranslateTUSresponseError } from '../../services/save-vote.service';

export enum RecordStateEnum {
  unrecord = 1,
  recording = 2,
  recorded = 3,
}

@Component({
  standalone: false,
  selector: 'voice-question',
  templateUrl: './voice-question.component.html',
  styleUrls: ['./voice-question.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VoiceQuestionComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => VoiceQuestionComponent),
      multi: true,
    },
  ],
})
export class VoiceQuestionComponent extends CustomControlBase implements OnInit, Validator {
  timer: any;
  typeOfState: RecordStateEnum = RecordStateEnum.unrecord;
  timerCounter: number = 0;
  maxTimeSeconds: number | null = null;

  audioUrl: string | null = null; // اضافه کردن ویژگی برای URL صوتی
  audioFile: File | null = null;
  errorName: string | null = null;
  recordResult?: RecordResult;

  @Input() item!: QuestionModel;

  recordSevice: IVoiceRecordService;

  constructor(injector: Injector) {
    super(injector);
    this.recordSevice = new WebVoiceRecorder(this.alert, this.translateService);
  }

  ngOnInit(): void {
    if (!this.item.answer || Array.isArray(this.item.answer) === false) {
      this.item.answer = [];
    }
    if (this.item.maximumAnswer) {
      this.maxTimeSeconds = +this.item.maximumAnswer * 60;
    } else {
      this.maxTimeSeconds = null;
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    let errors: ValidationErrors | null;
    this.item.invalid = true;
    if (this.item.isRequired && (this.item.answer.length === 0 || this.typeOfState != RecordStateEnum.recorded)) {
      errors = { required: true };
    } else if (
      (!this.item.isRequired && this.item.answer.length > 0 && this.typeOfState != RecordStateEnum.recorded) ||
      this.typeOfState == RecordStateEnum.recording
    ) {
      errors = { invalid: true };
    } else {
      this.item.invalid = false;
      errors = null;
    }

    this.myControl.setErrors(errors);
    return this.myControl.errors;
  }

  deleteFile(): void {
    this.item.answer = [];
    this.selectionChange();
  }

  selectionChange() {
    this.myControl.setValue(this.item.answer ?? []);
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
    this.logicService.changeAnswer(this.item, false);
    this.logicService.updateProgressBar();
  }

  writeValue(obj: any): void {
    this.myControl.setValue(obj ?? []);
  }

  public get RecordStateEnum(): typeof RecordStateEnum {
    return RecordStateEnum;
  }

  clearRecording() {
    this.deleteFile();
    this.typeOfState = RecordStateEnum.unrecord;
    this.audioUrl = null;
  }
  startRecording() {
    this.recordSevice
      .start({
        pollUniqueId: this.vote.pollData.uniqueId,
        formGuid: this.vote.formGuid,
        formChecksum: this.vote.formChecksum,
        resetRecordedData: true,
      })
      .then((result) => {
        this.successCallbackOfstartRecording(result);
      })
      .catch((error) => {
        this.errorCallbackOfstartRecording(error);
      });
  }

  private successCallbackOfstartRecording(result: any): void {
    this.typeOfState = RecordStateEnum.recording;
    this.startTimer();
    this.errorName = null;
    this._onValidatorChange();
  }

  private errorCallbackOfstartRecording(error: any): void {
    if (error.name === 'NotFoundError' || error.message?.includes('Requested device not found')) {
      this.errorName = 'NotFoundError';
      console.log('Microphone not found.');
      return;
    } else if (error.name === 'NotAllowedError') {
      this.errorName = 'NotAllowedError';
      console.error('Permission denied for microphone access:', error);
      return;
    } else if (error.name === 'OverconstrainedError') {
      this.errorName = 'OverconstrainedError';
      console.error('Constraints are too strict:', error);
      return;
    } else {
      console.error('Unexpected error accessing microphone:', error);
      return;
    }
  }

  stopRecording() {
    this.recordSevice
      .stop({
        pollUniqueId: this.vote.pollData.uniqueId,
        formGuid: this.vote.formGuid,
        formChecksum: this.vote.formChecksum,
        voiceRecordToken: this.vote.voiceRecordToken,
      })
      .then((result) => {
        this.successCallbackOfstopRecording(result);
      })
      .catch((error) => {
        this.errorCallbackOfstopRecording(error);
      });
  }

  private successCallbackOfstopRecording(result: any): void {
    this.stopTimer();
    this.audioFile = new File([result.audioBlob], 'recording_' + this.item.uniqueId + '.ogg', {
      type: 'audio/ogg',
      lastModified: new Date().getTime(), // Use the current timestamp
    });
    this.audioUrl = URL.createObjectURL(result.audioBlob);
    this.uploadFile();
  }

  private errorCallbackOfstopRecording(error: any): void {
    console.log('record', error);
  }

  startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.timerCounter++;

      if (this.maxTimeSeconds && this.timerCounter > this.maxTimeSeconds) {
        this.stopRecording();
      }
    }, 1000);
  }

  stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timerCounter = 0;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////

  uploadFile() {
    const reader = new FileReader();
    reader.onload = ((file: File) => {
      return (e: any) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const name = file.name;
        const hsize = humanFileSize(file.size);
        const fileType = file.type;
        if (!this.item.answer || Array.isArray(this.item.answer) === false) {
          this.item.answer = [];
        }
        this.item.answer.push({
          ext,
          name,
          size: file.size,
          humanSize: hsize,
          fileType,
          data: isImage(ext) ? e.target.result : '',
          isImage: isImage(ext),
          isVideo: isVideo(ext),
          progress: 0,
          status: UploadStatusEnum.Ready,
          file,
        } as FileModel);
        this.uploadFileFinaly(file);
      };
    })(this.audioFile as File);
    reader.readAsDataURL(this.audioFile as File);
  }

  uploadFileFinaly(file: any): void {
    let token: any = '';
    if (this.item.formQuestionFileUploadTokenDtos && this.item.formQuestionFileUploadTokenDtos[0]) {
      token = this.item.formQuestionFileUploadTokenDtos[0].uniqueId;
    }
    if (this.item.answer[0]) {
      this.item.answer[0].status = UploadStatusEnum.Uploading;
    }
    let metadata = {
      name: file.name,
      filename: file.name,
      emptyMetaKey: '',
      size: file.size + '',
      formGuid: this.vote.formGuid,
      pollUniqueId: this.vote.pollData.uniqueId + '',
      idCode: this.vote.identificationCode + '',
      formUniqueId: this.vote.pollData.formUniqueId + '',
    };
    console.info('tus metadata:', metadata);
    // Create a new tus upload
    const upload = new Upload(file, {
      // Endpoint is the upload creation URL from your tus server
      endpoint: AppConsts.remoteBaseUrl + '/FileStorage_CDN',
      // Retry delays will enable tus-js-client to automatically retry on errors
      retryDelays: [1000, 3000, 4000],
      // Attach additional meta data about the file for the server
      chunkSize: 2 * 1024 * 1024, // byte,//2Mb
      metadata,
      headers: {
        fileToken: token,
      },
      overridePatchMethod: true,
      parallelUploads: 1,
      httpStack: new ReplaceContentTypeHttpStack(),
      onBeforeRequest: (req) => {
        if (req.getURL().endsWith('FileStorage_CDN')) {
          req.setHeader('content-type', 'application/octet-stream');
        }
      },
      // Callback for errors which cannot be fixed using retries
      onError: (error) => {
        this.notify.error(this.translateService.instant('UploadFailed'));
        console.error('Failed because: ' + error);
        if (this.item.answer[0]) {
          this.item.answer[0].status = UploadStatusEnum.Failed;
        }
        for (const key in localStorage) {
          if (key.includes('tus')) {
            localStorage.removeItem(key);
          }
        }
      },
      // Callback for reporting upload progress
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        if (this.item.answer[0]) {
          this.item.answer[0].progress = percentage;
        }
        // console.log(this.item.answer[0]);
        // setTimeout(() => {
        //   currentFile.progress = 0;
        // }, 15000);
      },
      onSuccess: () => {
        if (this.item.answer[0]) {
          this.item.answer[0].status = UploadStatusEnum.Success;
          this.typeOfState = RecordStateEnum.recorded;
          this.selectionChange();
        }
        for (const key in localStorage) {
          if (key.includes('tus')) {
            localStorage.removeItem(key);
          }
        }
      },
      onShouldRetry: (error: any, retryAttempt: number, options: UploadOptions) => {
        const status = error.originalResponse ? error.originalResponse.getStatus() : 0;
        const responseBody = error.originalResponse ? error.originalResponse.getBody() : '';
        // If the status is a 403, we do not want to retry.
        if ([401, 403, 404, 406, 417, 410, 415, 510].indexOf(status) > -1) {
          this.alert.show({
            title: this.translateService.instant('Error') + ': ' + status,
            text: TranslateTUSresponseError(this.translateService, responseBody, status),
            confirmButtonText: this.translateService.instant('Ok'),
          });
          return false;
        }
        setTimeout(() => {
          if (this.item.answer[0]) {
            this.item.answer[0].status = UploadStatusEnum.TryingAgain;
          }
        }, 300);
        // For any other status code, tus-js-client should retry.
        return true;
      },
      onAfterResponse: (req: HttpRequest, res: HttpResponse) => {
        const fileaddressurl = res.getHeader('fileaddressurl');
        const fileId = res.getHeader('fileid');
        const fileUniqueId = res.getHeader('fileidunique');
        if (this.item.answer[0] && fileId) {
          this.item.answer[0].fileId = fileId;
          this.item.answer[0].fileUniqueId = fileUniqueId;
          this.item.answer[0].address = fileaddressurl;
        }
      },
    });

    // Check if there are any previous uploads to continue.
    upload.findPreviousUploads().then((previousUploads: string | any[]) => {
      // Found previous uploads so we select the first one.
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      // Start the upload
      upload.start();
    });
  }
}
