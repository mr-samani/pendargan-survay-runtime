import { Component, OnInit, Injector } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { PollAuthenticationResultEnum } from '@core/models/backend-dto/PollAuthenticationResultEnum';
import { GetPollGuidByTokenOutputDto } from '@core/models/backend-dto/GetPollGuidByTokenOutputDto';
import { GetPollGuidByTokenInputDto } from '@core/models/backend-dto/GetPollGuidByTokenInputDto';
import { AppConsts } from '@core/app-consts';
import { VoteBaseComponent } from '../vote-base.component';

import { LuxonFormatPipe } from '@core/pipe/luxon-format.pipe';
import { DateTime } from 'luxon';
import { UtcDateTimeHelper } from '@core/helper/utc-datetime.helper';
import { CaptchaInput } from '@core/models/backend-dto/CaptchaInput';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';

export interface DialogData {
  shortLink: string;
  result: GetPollGuidByTokenOutputDto;
}
@Component({
  selector: 'last-voter-of-participant-dialog',
  templateUrl: './last-voter-of-participant.component.html',
  styleUrls: ['./last-voter-of-participant.component.scss'],
  standalone: false,
})
export class LastVoterOfParticipantComponent extends VoteBaseComponent implements OnInit {
  shortLink = '';
  data?: GetVoterFullDetail;
  guid = '';
  /** نمایش دکمه ثبت فرم جدید */
  showNewVote = false;
  /** نمایش دکمه رد نتیجه و ثبت فرم جدید */
  showRejectAndNew = false;
  ribbonTitle = '';

  loading = false;
  constructor(injector: Injector) {
    super(injector);
    this.shortLink = this.route.snapshot.params['shortLink'];
  }

  ngOnInit(): void {
    if (!this.vote.lastVoterOfParticipant) {
      if (AppConsts.tenancyName) {
        this.router.navigate(['/' + AppConsts.tenancyName + '/' + this.shortLink]);
      } else {
        this.router.navigate(['/' + this.shortLink]);
      }
      return;
    }
    this.getPollGuid(false);
    this.showNewVote = this.vote.iPollHasUnlimitedParticipation === true;
    this.showRejectAndNew = this.vote.allowRejectResultByParticipant === true;

    let date = '';
    let time = '';
    if (this.vote.lastVoterOfParticipant) {
      let datetime = DateTime.fromJSDate(new Date((this.vote.lastVoterOfParticipant.registerDateAndTime ?? '') as any));
      date = new LuxonFormatPipe(this.translateService).transform(
        UtcDateTimeHelper.convertUtcToLocalDateTime(datetime).localDateTime,
        'D',
      );
      time = new LuxonFormatPipe(this.translateService).transform(
        UtcDateTimeHelper.convertUtcToLocalDateTime(datetime).localDateTime,
        'HH:mm',
      );
    }

    this.ribbonTitle = this.translateService.instant('ConfirmLoadLastVoter{date}{time}', { date, time });
  }

  getPollGuid(isNewVoter: boolean): void {
    this.mainSpinnerService.showLoading = true;
    const input: GetPollGuidByTokenInputDto = {
      pollTokenValue: this.shortLink,
      twoFactorAuthenticationCode: '',
      isSendTwoFactor: false,
      idCode: this.vote.lastVoterOfParticipant?.identificationCode + '',
      captchaResponse: new CaptchaInput(),
      selectedVoterForRejectByParticipant: this.vote.lastVoterOfParticipant?.voterGuid,
      isNewVoter: isNewVoter,
    };
    this.dataService
      .post<GetPollGuidByTokenOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.getPollGuidByToken, input)
      .pipe(
        finalize(() => {
          this.mainSpinnerService.showLoading = false;
        }),
      )
      .subscribe({
        next: (resp) => {
          if (resp.result && resp.result.guid) {
            this.guid = resp.result.guid;
            this.vote.titleButtonToParticipate = resp.result.titleButtonToParticipate ?? '';
            if (isNewVoter) {
              if (AppConsts.tenancyName) {
                this.router.navigate(['/' + AppConsts.tenancyName + '/new-vote/' + this.shortLink + '/' + this.guid]);
              } else {
                this.router.navigate(['/new-vote/' + this.shortLink + '/' + this.guid]);
              }
            } else {
              this.getVoteDetails();
            }
          } else {
            this.alert
              .show({
                text: this.translateService.instant('AnErrorOccurredOnTheServer'),
                confirmButtonText: this.translateService.instant('Ok'),
              })
              .then(() => {
                this.publicService.closeWindow();
              });
          }
        },
        error: (er) => {
          this.mainSpinnerService.showLoading = false;
          this.handleApiError(er, true);
        },
      });
  }

  getVoteDetails(): void {
    this.loading = true;
    this.dataService
      .post<GetVoterFullDetail>(AppConsts.apiBaseUrl + AppConsts.serverApis.getVoterDetailByReservedGuid, {
        id: this.guid,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (resp) => {
          this.data = resp.result;
        },
        error: (er) => {
          this.loading = false;
          this.handleApiError(er, true);
        },
      });
  }

  rejectAndNewVote() {
    this.mainSpinnerService.showLoading = true;
    this.dataService
      .post<GetVoterFullDetail>(AppConsts.apiBaseUrl + AppConsts.serverApis.rejectVoterByReservedGuid, {
        id: this.guid,
      })
      .pipe(
        finalize(() => {
          this.mainSpinnerService.showLoading = false;
        }),
      )
      .subscribe({
        next: (resp) => {
          this.newVote();
        },
        error: (er) => {
          this.mainSpinnerService.showLoading = false;
          this.handleApiError(er, true);
        },
      });
  }

  newVote() {
    this.getPollGuid(true);
  }

  checkApiResult(result: GetPollGuidByTokenOutputDto) {
    if (!result) {
      this.notify.error(this.translateService.instant('AnErrorOccurredOnTheServer'));
      return;
    }
    if (result && result.message) {
      this.notify.info(result.message);
    }
    this.vote.allocationType = result.allocationType;
    switch (result.authResult) {
      case PollAuthenticationResultEnum.Success:
        if (AppConsts.tenancyName) {
          this.router.navigate(['/' + AppConsts.tenancyName + '/new-vote/' + this.shortLink + '/' + result.guid]);
        } else {
          this.router.navigate(['/new-vote/' + this.shortLink + '/' + result.guid]);
        }
        break;
      case PollAuthenticationResultEnum.NotAllowedPoll:
        this.alert
          .show({
            text: this.translateService.instant('YouAreNotAllowedToParticipate'),
            confirmButtonText: this.translateService.instant('Ok'),
          })
          .then(() => {
            this.publicService.closeWindow();
          });
        break;
    }
  }
}
