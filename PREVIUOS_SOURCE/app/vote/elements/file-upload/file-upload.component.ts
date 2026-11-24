import { HttpClient } from '@angular/common/http';
import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { QuestionModel } from '@core/models/QuestionModel';
import { FileModel, UploadStatusEnum } from './file.model';
import { FileSettingDataDto } from '@core/models/backend-dto/FileSettingDto';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { FileSelectionTypeEnum, FileStateEnum } from '../file-upload-pwa/file-upload-pwa.model';
import { AppConsts } from '@core/app-consts';
import { humanFileSize, isImage, isVideo } from '@core/helper/file.helper';
import { Upload, UploadOptions, HttpResponse, HttpRequest } from 'tus-js-client';
import { Platform } from '@angular/cdk/platform';
import { ReplaceContentTypeHttpStack } from '@core/helper/ReplaceContentTypeHttpStack';
import { number } from 'mathjs';
import { TranslateTUSresponseError } from '../../services/save-vote.service';

@Component({
  standalone: false,
  selector: 'file-upload',
  templateUrl: './file-upload.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FileUploadComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => FileUploadComponent),
      multi: true,
    },
  ],
})
export class FileUploadComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  acceptedInputFile = '';
  dragOver = false;

  minFileCount = 0;
  maxFileCount?: number;
  /** max file size is KB */
  maxFileSize = 0;
  /** min file size is KB */
  minFileSize = 0;
  humanizeMaxSize = '';
  humanizeMinSize = '';
  allowedTypes: string[] = [];

  isRtl = false;
  isMobileDevice: boolean;
  constructor(
    injector: Injector,
    private http: HttpClient,
    platform: Platform,
  ) {
    super(injector);
    this.isRtl = this.languageService.isRtl;
    this.isMobileDevice = platform.ANDROID || platform.IOS;
  }

  ngOnInit(): void {
    if (!this.item.fileUploadSettingDto) {
      this.item.fileUploadSettingDto = new FileSettingDataDto();
    }
    this.minFileCount = this.item.fileUploadSettingDto.minFileCount ?? 0;
    this.maxFileCount = this.item.fileUploadSettingDto.maxFileCount;
    // نکته»: در هنگام لود حجم حداقل و حداکثر به کیلو بایت تبدیل شده اند
    this.maxFileSize = this.item.fileUploadSettingDto.maxSize ?? 0;
    this.minFileSize = this.item.fileUploadSettingDto.minSize ?? 0;
    this.humanizeMaxSize = humanFileSize(this.maxFileSize * 1024);
    this.humanizeMinSize = humanFileSize(this.minFileSize * 1024);

    if (this.item.fileUploadSettingDto.extension) {
      this.allowedTypes = this.item.fileUploadSettingDto?.extension?.split(/،|,/);
    }
    this.acceptedInputFile = this.item.fileUploadSettingDto.extension ?? '';
    if (!this.item.answer || Array.isArray(this.item.answer) === false) {
      this.item.answer = [];
    }
    if (!this.item.settings || !this.item.settings.fileSelectionType) {
      this.item.settings = {
        fileSelectionType: FileSelectionTypeEnum.SelectFile,
      };
    }
    this.changeDetectorRef.detectChanges();
  }

  public get UploadStatusEnum(): typeof UploadStatusEnum {
    return UploadStatusEnum;
  }

  writeValue(obj: any): void {
    this.myControl.setValue(obj ?? []);
  }
  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    const answer: any[] = this.item.answer ?? [];
    const completed = answer.filter(
      (x) => x.status === UploadStatusEnum.Success || x.fileState === FileStateEnum.OnLocal,
    ).length;
    const minimumSize = Math.min(...answer.map((m) => +m.size));
    const maximumSize = Math.max(...answer.map((m) => +m.size));
    // console.log('file upload validation= completed:', completed, 'fileCount:', answer.length, 'value', control.value);
    let errors: ValidationErrors | null;
    this.item.invalid = true;
    if (!this.item.isRequired && answer.length === 0) {
      this.item.invalid = false;
      errors = null;
    } else if (answer.length < this.minFileCount) {
      errors = { min: true, invalid: true };
    } else if (this.maxFileCount !== undefined && answer.length > this.maxFileCount) {
      errors = { max: true, invalid: true };
    } else if (this.maxFileSize && this.maxFileSize < Math.round(maximumSize / 1024)) {
      errors = { invalid: true, maxFileSize: true };
    } else if (this.minFileSize && this.minFileSize > Math.round(minimumSize / 1024)) {
      errors = { invalid: true, minFileSize: true };
    } else if (this.item.isRequired && completed === 0) {
      errors = { invalid: true };
    } else if (completed < answer.length) {
      errors = { invalid: true };
    } else {
      this.item.invalid = false;
      errors = null;
    }
    this.myControl.setErrors(errors);
    return this.myControl.errors;
  }

  fileChange(ev: any): void {
    if (this.disabled) {
      return;
    }
    const fileList = ev.currentTarget.files;
    if (this.allowedTypes.length === 0) {
      this.notify.warning(this.translateService.instant('FileUploadSettingNotExist'));
      return;
    }
    if (
      this.maxFileCount !== undefined &&
      fileList.length &&
      fileList.length + this.item.answer?.length > this.maxFileCount
    ) {
      this.notify.warning(
        this.translateService.instant('MaximumAllowedFileCount{value}', { value: this.maxFileCount }),
      );
      return;
    }
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < fileList.length; i++) {
      if (this.checkAllowedFile(fileList[i]) === false) {
        continue;
      }

      const reader = new FileReader();
      // Closure to capture the file information.
      reader.onload = ((file) => {
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
            // file: file.arrayBuffer,
            isImage: isImage(ext),
            isVideo: isVideo(ext),
            progress: 0,
            status: UploadStatusEnum.Ready,
            file,
          } as FileModel);
          // upload
          this.uploadFile(file, this.item.answer.length - 1);
          this._onValidatorChange();
        };
      })(fileList[i]);
      reader.readAsDataURL(fileList[i]);
    }
  }

  uploadFile(file: any, fileIndex: number): void {
    let token: any = '';
    if (this.item.formQuestionFileUploadTokenDtos && this.item.formQuestionFileUploadTokenDtos[fileIndex]) {
      token = this.item.formQuestionFileUploadTokenDtos[fileIndex].uniqueId;
    }
    if (this.item.answer[fileIndex]) {
      this.item.answer[fileIndex].status = UploadStatusEnum.Uploading;
    }
    let metadata = {
      name: file.name,
      filename: file.name,
      emptyMetaKey: '',
      size: file.size + '',
      formGuid: this.vote.formGuid,
      pollUniqueId: this.vote.pollData.uniqueId,
      idCode: this.vote.identificationCode + '',
      formUniqueId: this.vote.pollData.formUniqueId,
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
        if (this.item.answer[fileIndex]) {
          this.item.answer[fileIndex].status = UploadStatusEnum.Failed;
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
        if (this.item.answer[fileIndex]) {
          this.item.answer[fileIndex].progress = percentage;
        }
        // console.log(this.item.answer[fileIndex]);
        // setTimeout(() => {
        //   currentFile.progress = 0;
        // }, 15000);
      },
      onSuccess: () => {
        if (this.item.answer[fileIndex]) {
          this.item.answer[fileIndex].status = UploadStatusEnum.Success;
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
          if (this.item.answer[fileIndex]) {
            this.item.answer[fileIndex].status = UploadStatusEnum.TryingAgain;
          }
        }, 300);
        // For any other status code, tus-js-client should retry.
        return true;
      },
      onAfterResponse: (req: HttpRequest, res: HttpResponse) => {
        const fileaddressurl = res.getHeader('fileaddressurl');
        const fileId = res.getHeader('fileid');
        const fileUniqueId = res.getHeader('fileidunique');
        if (this.item.answer[fileIndex] && fileId) {
          this.item.answer[fileIndex].fileId = fileId;
          this.item.answer[fileIndex].fileUniqueId = fileUniqueId;
          this.item.answer[fileIndex].address = fileaddressurl;
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

  checkAllowedFile(file: File): boolean {
    const type = file.name.split('.').pop()?.toLowerCase() || '';
    const size = file.size;
    if (this.allowedTypes.indexOf('.' + type) < 0) {
      this.notify.error(this.translateService.instant('SelectedFileIsNotAllowed'));
      return false;
    } else if (this.maxFileSize && this.maxFileSize < Math.round(size / 1024)) {
      this.notify.error(
        this.translateService.instant('YourFileSizeIsMoreThan{value}', {
          value: this.humanizeMaxSize,
        }),
      );
      return false;
    } else if (this.minFileSize && this.minFileSize > Math.round(size / 1024)) {
      this.notify.error(
        this.translateService.instant('YourFileSizeIsLessThan{value}', {
          value: this.humanizeMinSize,
        }),
      );
      return false;
    } else {
      return true;
    }
  }

  deleteFile(f: any, question: QuestionModel): void {
    question.answer.forEach((item: FileModel, index: number) => {
      if (item === f) {
        question.answer.splice(index, 1);
      }
    });
    this.selectionChange();
  }

  // errorMgmt(error: HttpErrorResponse): Observable<string> {
  //   let errorMessage = '';
  //   if (error.error instanceof ErrorEvent) {
  //     // Get client-side error
  //     errorMessage = error.error.message;
  //   } else {
  //     // Get server-side error
  //     errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
  //   }
  //   this.alert.show(errorMessage);
  //   // this.notify.error(errorMessage);
  //   return throwError(errorMessage);
  // }

  selectionChange() {
    this.myControl.setValue(this.item.answer ?? []);
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
    this.logicService.changeAnswer(this.item, false);
    this.logicService.updateProgressBar();
  }

  retry(index: number) {
    let file = this.item.answer[index]?.file;
    if (file) {
      this.uploadFile(file, index);
    }
  }

  async openCaptureDialog() {
    if (this.allowedTypes.length === 0) {
      this.notify.warning(this.translateService.instant('FileUploadSettingNotExist'));
      return;
    }
    if (this.maxFileCount !== undefined && this.item.answer?.length + 1 > this.maxFileCount) {
      this.notify.warning(
        this.translateService.instant('MaximumAllowedFileCount{value}', { value: this.maxFileCount }),
      );
      return;
    }

    const { CameraCaptureComponent } = await import('./camera-capture/camera-capture.component');
    this.matDialog
      .open(CameraCaptureComponent)
      .afterClosed()
      .subscribe((fileResult: File) => {
        if (!fileResult) {
          return;
        }
        if (this.checkAllowedFile(fileResult) === false) {
          return;
        }

        const reader = new FileReader();
        // Closure to capture the file information.
        reader.onload = ((file) => {
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
              // file: file.arrayBuffer,
              isImage: isImage(ext),
              isVideo: isVideo(ext),
              progress: 0,
              status: UploadStatusEnum.Ready,
              file,
            } as FileModel);
            // upload
            this.uploadFile(file, this.item.answer.length - 1);
            this._onValidatorChange();
          };
        })(fileResult);
        reader.readAsDataURL(fileResult);
      });
  }
}

// export function fileCountValidation(item: QuestionModel, fileCount: number): ValidatorFn {
//   return (control: AbstractControl): ValidationErrors | null => {
//     let answer: any[] = control.value || [];
//     let completed = answer.filter(x =>
//       x.status === UploadStatusEnum.Success || x.fileState === UploadStatusEnum.Success).length;
//     console.log('file upload validation= completed:', completed, 'fileCount:', fileCount, 'value', control.value);
//     if (completed > fileCount) {
//       return { max: true };
//     } else if (completed < fileCount) {
//       return { min: true };
//     }
//     return null;
//   }
// }
