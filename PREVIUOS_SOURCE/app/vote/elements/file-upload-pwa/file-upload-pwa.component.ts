import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { FileSettingDataDto } from '@core/models/backend-dto/FileSettingDto';
import { QuestionModel } from '@core/models/QuestionModel';
import { FileModel, UploadStatusEnum } from '../file-upload/file.model';
import { FileSelectionTypeEnum, FileStateEnum, FormUploadFileDto } from './file-upload-pwa.model';
import { finalize } from 'rxjs/operators';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { EventEnum } from '@core/models/enums';
import { ExpressionTargetsEnum } from '@core/models/backend-dto/ExpressionTargetsEnum';
import { AppConsts } from '@core/app-consts';
import { humanFileSize, isImage, isVideo } from '@core/helper/file.helper';

export class PwaUploadComplete {
  formQuestionUniqueId!: string;

  /**
   * file name
   */
  name!: string;
  /**
   * file size byte
   */
  size!: number;
  /**
   * file content type like='image/jpeg'
   */
  type!: string;

  progress?: number;

  fileId!: number;
  fileUniqueId!: string;
  fileHash!: string;
  resultCode!: number;
  fileState?: FileStateEnum;
  addressUrl!: string;
}

export class PwaDeleteComplete {
  fileId?: number;
  fileGuid?: string;
  fileHash?: string;
  resultCode?: number;
  fileState?: FileStateEnum;
}

@Component({
  standalone: false,
  selector: 'file-upload-pwa',
  templateUrl: './file-upload-pwa.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FileUploadPWAComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => FileUploadPWAComponent),
      multi: true,
    },
  ],
})
export class FileUploadPWAComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  allowedTypes: string[] = [];

  minFileCount = 0;
  maxFileCount?: number;
  /** max file size is KB */
  maxFileSize = 0;
  /** min file size is KB */
  minFileSize = 0;
  humanizeMaxSize = '';
  humanizeMinSize = '';

  voterLoopIndexNumber = 0;
  isRtl = false;
  constructor(injector: Injector) {
    super(injector);
    this.isRtl = this.languageService.isRtl;
  }

  writeValue(obj: any): void {
    this.myControl.setValue(obj);
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
    if (!this.item.answer || Array.isArray(this.item.answer) === false) {
      this.item.answer = [];
    }
    if (!this.item.settings || !this.item.settings.fileSelectionType) {
      this.item.settings = {
        fileSelectionType: FileSelectionTypeEnum.SelectFile,
      };
    }
    app.event.on(EventEnum.PwaFileDeleteEvent, (data: string) => {
      this.handleDeleteEvent(data);
    });

    app.event.on(EventEnum.PwaFileUploadEvent, (data: string) => {
      this.handleUploadEvent(data);
    });
  }

  private handleDeleteEvent(data: string) {
    if (!this.item.answer || Array.isArray(this.item.answer) === false) {
      this.item.answer = [];
    }
    const result: PwaDeleteComplete = JSON.parse(data);
    this.item.answer.forEach((item: FileModel, index: number) => {
      if (item.fileId === result.fileId) {
        this.item.answer.splice(index, 1);
      }
    });
    this.selectionChange();
  }

  private handleUploadEvent(data: string) {
    if (!this.item.answer || Array.isArray(this.item.answer) === false) {
      this.item.answer = [];
    }
    const file: PwaUploadComplete = JSON.parse(data);
    if (file && file.formQuestionUniqueId === this.item.uniqueId) {
      console.log('app upload result', data);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const name = file.name;
      const hsize = humanFileSize(file.size);
      const fileType = file.type;
      const IsImage = isImage(ext);
      const IsVideo = isVideo(ext);
      let isUpdate = false;
      for (const ff of this.item.answer) {
        if (ff.fileUniqueId === file.fileUniqueId) {
          isUpdate = true;
          ff.fileId = file.fileId;
          ff.fileUniqueId = file.fileUniqueId;
          ff.fileHash = file.fileHash;
          ff.ext = ext;
          ff.name = name;
          ff.size = file.size;
          ff.humanSize = hsize;
          ff.fileType = fileType;
          ff.addressUrl = file.addressUrl;
          ff.isImage = IsImage;
          ff.isVideo = IsVideo;
          ff.progress = file.progress ?? 0;
          ff.fileState = file.fileState;
          break;
        }
      }
      if (isUpdate === false) {
        if (this.checkAllowedFile(file) === false) {
          return;
        }
        if (this.maxFileCount !== undefined && this.item.answer && this.item.answer.length > this.maxFileCount) {
          this.notify.warning(
            this.translateService.instant('MaximumAllowedFileCount{value}', { value: this.maxFileCount }),
          );
          return;
        }
        this.item.answer.push({
          fileId: file.fileId,
          fileUniqueId: file.fileUniqueId,
          fileHash: file.fileHash,
          ext,
          name,
          size: file.size,
          humanSize: hsize,
          fileType,
          addressUrl: file.addressUrl,
          isImage: IsImage,
          isVideo: IsVideo,
          progress: file.progress ?? 0,
          fileState: file.fileState,
        } as FileModel);
      }

      // if (file.fileState === FileStateEnum.Uploaded) {
      this.selectionChange();
      // }
    }
  }
  setVoterLoopIndexNumber() {
    let thisSectionHasLoopFormula = this.vote.formulaList.filter(
      (x) =>
        x.targetKey === this.item.uniqueIdPerForm && x.targetType === ExpressionTargetsEnum.SectionLoop && x.isActive,
    );
    if (thisSectionHasLoopFormula.length > 0) {
      this.voterLoopIndexNumber = (this.vote.sections[this.vote.currentSectionPage].loopNumber ?? 0) + 1;
    } else {
      this.voterLoopIndexNumber = 1;
    }
  }

  selectFile(fileSelectionType: FileSelectionTypeEnum): void {
    if (this.disabled || this.mainSpinnerService.showLoading) {
      return;
    }
    if (this.maxFileCount !== undefined && this.item.answer && this.item.answer.length > this.maxFileCount) {
      this.notify.warning(
        this.translateService.instant('MaximumAllowedFileCount{value}', { value: this.maxFileCount }),
      );
      return;
    }
    this.mainSpinnerService.showLoading = true;

    this.setVoterLoopIndexNumber();

    const input = new FormUploadFileDto();
    input.authCode = '';
    input.name = '';
    input.formGuid = this.vote.formGuid;
    input.pollUniqueId = this.vote.pollData.uniqueId;
    input.size = -1;
    input.formQuestionUniqueId = this.item.uniqueId;
    input.data = '';
    input.minSize = this.item.fileUploadSettingDto?.minSize;
    input.maxSize = this.item.fileUploadSettingDto?.maxSize;
    input.minImageHeight = this.item.fileUploadSettingDto?.minImageHeight;
    input.maxImageHeight = this.item.fileUploadSettingDto?.maxImageHeight;
    input.minImageWidth = this.item.fileUploadSettingDto?.minImageWidth;
    input.maxImageWidth = this.item.fileUploadSettingDto?.maxImageWidth;
    input.contentType = this.item.fileUploadSettingDto?.contentType;
    input.extension = this.item.fileUploadSettingDto?.extension ?? '';
    input.minFileCount = this.item.fileUploadSettingDto?.minFileCount;
    input.maxFileCount = this.item.fileUploadSettingDto?.maxFileCount;
    input.validationCountdown = this.item.fileUploadSettingDto?.validationCountdown;
    input.fileSettingUniqueId = this.item.fileUploadSettingDto?.uniqueId;
    input.keyUniqueId = this.item.fileUploadSettingDto?.keyUniqueId;
    input.valueUniqueId = this.item.fileUploadSettingDto?.valueUniqueId;
    input.fileSelectionType = fileSelectionType;
    input.voterLoopIndexNumber = this.voterLoopIndexNumber;
    this.dataService
      .post(AppConsts.hybridUrl + AppConsts.pwaUrls.pwaUploadFile, input)
      .pipe(
        finalize(() => {
          setTimeout(() => {
            this.mainSpinnerService.showLoading = false;
          }, 2000);
        }),
      )
      .subscribe(() => {});
  }

  deleteFile(f: any, question: QuestionModel): void {
    this.mainSpinnerService.showLoading = true;
    this.dataService
      .post(AppConsts.hybridUrl + AppConsts.pwaUrls.pwaDeleteFile, {
        fileId: f.fileId,
        fileUniqueId: f.fileUniqueId,
        fileHash: f.fileHash,
        fileState: f.fileState,
      })
      .pipe(
        finalize(() => {
          setTimeout(() => {
            this.mainSpinnerService.showLoading = false;
          }, 3000);
        }),
      )
      .subscribe((response) => {
        if (response && response.result == true) {
          question.answer.forEach((item: FileModel, index: number) => {
            if (item.fileUniqueId === f.fileUniqueId) {
              question.answer.splice(index, 1);
            }
          });
          this.selectionChange();
        }
      });
  }

  selectionChange() {
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
    this.logicService.changeAnswer(this.item, false);
    this.logicService.updateProgressBar();
  }

  checkAllowedFile(file: PwaUploadComplete): boolean {
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
}
