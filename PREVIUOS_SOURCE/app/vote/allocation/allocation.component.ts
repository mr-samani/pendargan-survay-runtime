import { Component, EventEmitter, Injector, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DateTime } from 'luxon';
import { finalize } from 'rxjs';
import { AppConsts } from '@core/app-consts';
import { UtcDateTimeHelper } from '@core/helper/utc-datetime.helper';
import { VoteBaseComponent } from '../vote-base.component';
import {
  AllocationStatusBaseTypeEnum,
  AllocationTypeEnum,
  ChangeStatusAllocationInputDto,
  ChangeStatusAllocationOutputDto,
  CommentTypeEnum,
  CreateOrEditAllocationStatusDto,
  GetAllAllocationStatusInputDto,
  PagedResultDtoOfCreateOrEditAllocationStatusDto,
  ScheduleTypeEnum,
} from './allocation.model';

@Component({
  standalone: false,
  selector: 'allocation',
  templateUrl: './allocation.component.html',
  styleUrls: ['./allocation.component.scss'],
})
export class AllocationComponent extends VoteBaseComponent implements OnInit {
  /** اگر وضعیت تخصیص حاضر و همکاری بود فقط می تواند بقیه پرسش ها و فرم را ببیند */
  @Output('presentAndCooperation') presentAndCooperation = new EventEmitter<boolean>();

  loading = true;
  saving = false;
  statuses: CreateOrEditAllocationStatusDto[] = [];
  // حاضر و همکاری
  copperationStatuse = {
    id: -1000,
  };
  form: FormGroup;
  minDate: any;
  constructor(injector: Injector, fb: FormBuilder) {
    super(injector);
    this.minDate = DateTime.now().toJSDate();
    this.form = fb.group({
      selectedStatus: [this.copperationStatuse, [Validators.required]],
      allocationComment: [''],
      newDate: [''],
      newTime: [''],
    });
  }

  ngOnInit(): void {
    this.getStatusList();
  }

  public get CommentTypeEnum(): typeof CommentTypeEnum {
    return CommentTypeEnum;
  }
  public get AllocationStatusBaseTypeEnum(): typeof AllocationStatusBaseTypeEnum {
    return AllocationStatusBaseTypeEnum;
  }
  public get ScheduleTypeEnum(): typeof ScheduleTypeEnum {
    return ScheduleTypeEnum;
  }
  public get Validators(): typeof Validators {
    return Validators;
  }

  getStatusList() {
    this.loading = true;
    let includeStatus = [AllocationStatusBaseTypeEnum.InUse, AllocationStatusBaseTypeEnum.Faild];

    const input: GetAllAllocationStatusInputDto = {
      filter: '',
      pollUniqueId: this.vote.pollData.uniqueId,
      includeAllocationStatusBaseType: includeStatus,
      notIncludes: [],
      allocationTypeFilter: this.vote.allocationType ?? AllocationTypeEnum.TelephoneAllocation,
      maxResultCount: 500,
      skipCount: 0,
    };
    this.dataService
      .post<PagedResultDtoOfCreateOrEditAllocationStatusDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getAllocationStatus,
        input,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((response) => {
        this.statuses = response.result.items ?? [];
      });
  }

  changeStatus() {
    if (this.form.invalid) {
      this.notify.warning(this.translateService.instant('CompleteFormInformationCorrectly'));
      this.form.markAllAsTouched();
      return;
    }
    this.alert
      .show({
        text: this.translateService.instant('AreYouSureChangeStatus'),
        showCancelButton: true,
        showConfirmButton: true,
        allowEnterKey: false,
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonText: this.translateService.instant('Ok'),
        cancelButtonText: this.translateService.instant('Cancel'),
      })
      .then((r) => {
        if (r.isConfirmed) {
          this.confirmChangeStatus();
        }
      });
  }

  confirmChangeStatus() {
    if (this.saving) {
      return;
    }
    const formValue = this.form.value;
    if (!formValue.selectedStatus || formValue.selectedStatus.id === -1000) {
      return;
    }
    this.saving = true;
    const input = new ChangeStatusAllocationInputDto();
    let status: CreateOrEditAllocationStatusDto = formValue.selectedStatus;
    input.allocationComment = formValue.allocationComment;
    input.allocationStatusUniqueId = status.uniqueId;
    if (formValue.newDate)
      input.newDateTime = UtcDateTimeHelper.convertLocalDateTimeToUTC(formValue.newDate, formValue.newTime) as any;
    input.identificationCode = this.vote.identificationCode;
    input.pollUniqueId = this.vote.pollData.uniqueId;
    //input.userUniqueId = this.vote
    this.dataService
      .post<ChangeStatusAllocationOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.changeStatusAllocation, input)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (response) => {
          let reasons = (response.result?.reasons ?? []).map((m) => `<li>${m}</li>`);
          let msg = '';
          if (response.result.isSuccessful) {
            msg = this.translateService.instant('SavedSuccessFully');
          } else {
            msg = this.translateService.instant('AnErrorOccurredOnTheServer');
          }
          this.alert
            .show({
              title: msg,
              html: '<ul>' + reasons + '</ul>',
              confirmButtonText: this.translateService.instant('Ok'),
            })
            .then((r) => {
              if (response.result.isSuccessful) {
                this.publicService.closeWindow('', true);
              }
            });
        },
        error: (error) => {
          this.handleApiError(error, false);
        },
      });
  }

  onChangeStatus() {
    const status: CreateOrEditAllocationStatusDto = this.form.get('selectedStatus')?.value;
    if (status && status.commentType === CommentTypeEnum.RequiredComment) {
      this.form.get('allocationComment')?.setValidators([Validators.required]);
    } else {
      this.form.get('allocationComment')?.clearValidators();
    }
    this.form.get('allocationComment')?.updateValueAndValidity();
    if (!this.form.get('selectedStatus')?.value || this.form.get('selectedStatus')?.value.id == -1000) {
      this.presentAndCooperation.emit(true);
    } else {
      this.presentAndCooperation.emit(false);
    }
  }

  // clear() {
  //   this.form.get('selectedStatus')?.reset();
  // }
}
