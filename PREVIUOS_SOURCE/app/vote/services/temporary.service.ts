import { Injectable, Injector } from '@angular/core';
import { LogicService } from './logic.service';
import { VoteSharedService } from './vote-service';
import { AppConsts } from '@core/app-consts';
import { ConverterDataService } from './converter-data.service';
import { DateTime } from 'luxon';
import { UtcDateTimeHelper } from '@core/helper/utc-datetime.helper';
import { LuxonFormatPipe } from '@core/pipe/luxon-format.pipe';
import { IResponse } from '@core/models/response';
import { BaseComponent } from '@app/base.component';
import { GetTempVoterForLoadDto } from '@core/models/backend-dto/GetTempVoterForLoadDto';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';

@Injectable()
export class SaveTemporaryService extends BaseComponent {
  constructor(
    private vote: VoteSharedService,
    private logicService: LogicService,
    private converterDataServer: ConverterDataService,
    injector: Injector,
  ) {
    super(injector);
  }

  /**
   * لود کردن داده های ذخیره موقت شده درون صفحه ها
   * @param tempVoter
   */
  private async loadTemporaryVoter(tempVoter: GetTempVoterForLoadDto, guid: string, callback?: Function) {
    if (!tempVoter) {
      if (callback) callback();
    } else {
      let date = '';
      let time = '';
      if (tempVoter.lastTempVoterChange) {
        let datetime = DateTime.fromJSDate(new Date(tempVoter.lastTempVoterChange as any));
        date = new LuxonFormatPipe(this.translateService).transform(
          UtcDateTimeHelper.convertUtcToLocalDateTime(datetime).localDateTime,
          'D',
        );
        time = new LuxonFormatPipe(this.translateService).transform(
          UtcDateTimeHelper.convertUtcToLocalDateTime(datetime).localDateTime,
          'HH:mm',
        );
      }
      this.alert
        .show({
          title: this.translateService.instant('SaveTemp'),
          text: this.translateService.instant('ConfirmLoadTempVoter{date}{time}', { date, time }),
          showConfirmButton: true,
          confirmButtonText: this.translateService.instant('Ok'),
          showCancelButton: true,
          cancelButtonText: this.translateService.instant('Cancel'),
          allowEnterKey: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        })
        .then((r) => {
          if (!r.isConfirmed) {
            if (callback) callback();
          } else {
            this.mainSpinnerService.showLoading = true;
            this.vote.acceptPreviousData = true;
            this.dataService
              .post<GetVoterFullDetail>(AppConsts.apiBaseUrl + AppConsts.serverApis.getVoterForEdit, {
                id: guid,
              })
              .subscribe({
                next: (response: IResponse<GetVoterFullDetail>) => {
                  this.converterDataServer.loadSavedData(this.logicService, response.result, tempVoter).finally(() => {
                    this.mainSpinnerService.showLoading = false;
                    if (callback) {
                      callback();
                    }
                  });
                },
                error: (err) => {
                  this.handleApiError(err, true);
                  this.mainSpinnerService.showLoading = false;
                },
              });
          }
        });
    }
  }

  async loadVoter(
    guid: string,
    voterSequentialUniqueId?: string,
    tempVoter?: GetTempVoterForLoadDto,
    callback?: Function,
  ) {
    if (tempVoter) {
      return this.loadTemporaryVoter(tempVoter, guid, callback);
    }
    if (!voterSequentialUniqueId) {
      if (callback) {
        callback();
      }
    } else {
      this.mainSpinnerService.showLoading = true;
      this.dataService
        .post<GetVoterFullDetail>(AppConsts.apiBaseUrl + AppConsts.serverApis.getVoterForEdit, {
          id: guid,
        })
        .subscribe({
          next: (response: IResponse<GetVoterFullDetail>) => {
            if (
              !response ||
              !response.result ||
              !response.result.voterDetail ||
              !response.result.formSections ||
              response.result.formSections.length == 0
            ) {
              this.alert
                .show({
                  text: this.translateService.instant('NoDataForEdit'),
                  confirmButtonText: this.translateService.instant('Ok'),
                })
                .then(() => {
                  this.publicService.closeWindow('', true);
                });
            } else {
              this.converterDataServer.loadSavedData(this.logicService, response.result).finally(() => {
                this.mainSpinnerService.showLoading = false;
                if (callback) {
                  callback();
                }
              });
            }
          },
          error: (er) => {
            this.handleApiError(er, true);
          },
        });
    }
  }

  /**
   * ذخیره موقت پاسخ های فرم
   */
  save(audioRecordFileUniqueId: string, audioRecordFileId?: number): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const currentSection = this.vote.sections[this.vote.currentSectionPage];
      await this.logicService.storeSection(currentSection, true);
      const postData = await this.converterDataServer.getDataForSave(this.logicService, true, false, '', '');
      postData.voterDetail.voiceRecordFileIdUnique = [
        {
          fileId: audioRecordFileId,
          fileUniqueId: audioRecordFileUniqueId,
          order: undefined,
        },
      ];
      this.dataService.post(AppConsts.apiBaseUrl + AppConsts.serverApis.savePoll, postData).subscribe({
        next: async (result) => {
          // بدلیل اینکه در پرسش ریتیل نیاز است  هر سطر انتخابی به یک سکشن تبدیل شود
          // به همین دلیل باید pages دوباره لود شود
          if (this.logicService.isRetailForm == true) {
            this.logicService.pages = [];
            for (let section of this.vote.sections) {
              const isNextButton = section.uniqueId != currentSection.uniqueId;
              await this.logicService.storeSection(section, isNextButton);
              if (section.uniqueId == currentSection.uniqueId) break;
            }
          }

          resolve(true);
        },
        error(er) {
          reject(er);
        },
      });
    });
  }
}
