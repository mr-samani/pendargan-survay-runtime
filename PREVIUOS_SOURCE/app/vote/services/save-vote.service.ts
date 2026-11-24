import { Inject, Injectable } from '@angular/core';
import { AppConsts, MobileSpecificErrorCodes } from '@core/app-consts';
import { LocationRequiredForVoterTypeEnum } from '@core/models/backend-dto/LocationRequiredForVoterTypeEnum';
import { HttpRequest, HttpResponse, Upload, UploadOptions } from 'tus-js-client';
import { NgForm } from '@angular/forms';
import { ConverterDataService } from './converter-data.service';
import { CreateOrEditVoterAndDetailsOutputDto } from '@core/models/backend-dto/CreateOrEditVoterAndDetailsOutputDto';
import { finalize } from 'rxjs';
import { EventEnum } from '@core/models/enums';
import { VoteSharedService } from './vote-service';
import { TranslateService } from '@ngx-translate/core';
import { LogicService } from './logic.service';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { DataService } from '@core/services/data-service.service';
import { SaveTemporaryService } from './temporary.service';
import { ToastrService } from 'ngx-toastr';
import { PublicService } from '@core/services/public.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MainSpinnerService } from '@app/main-spinner.service';
import { LOCATION_SERVICE } from '@core/location/location.token';
import { ILocationService } from '@core/location/location.interface';
import { IVoiceRecordService } from '@core/voice-record/voice-record.interface';
import { RecordedDeviceEnum } from '@core/voice-record/models/RecordedDeviceEnum';
import { VOICE_RECORD_SERVICE } from '@core/voice-record/voice-record.token';
import { ReplaceContentTypeHttpStack } from '@core/helper/ReplaceContentTypeHttpStack';
import { CreateVoterWithDetailsDto } from '@core/models/backend-dto/CreateVoterWithDetailsDto';
import { TrackExpressionDetail, TrackExpressionInputDto } from '@core/models/backend-dto/TrackExpressionInputDto';
import { ExpressionActionsEnum } from '@core/models/backend-dto/ExpressionActionsEnum';
declare var appCommand: any;

@Injectable()
export class SaveVoteService {
  isSavingForm = false;
  savingTemp = false;
  redirecting = false;
  uploadingLog = '';
  loadingGeoLocation = false;

  uploadingRecordedFile = false;
  uploadingRercordPercentage = 0;
  private audioRecordFileId?: number;
  private audioRecordFileUniqueId = '';

  constructor(
    @Inject(LOCATION_SERVICE) private locationService: ILocationService,
    @Inject(VOICE_RECORD_SERVICE) private voiceRecorderService: IVoiceRecordService,
    private converterDataServer: ConverterDataService,
    private translateService: TranslateService,
    private logicService: LogicService,
    private alert: NgxAlertModalService,
    private dataService: DataService,
    private saveTemporaryService: SaveTemporaryService,
    private notify: ToastrService,
    private publicService: PublicService,
    private route: ActivatedRoute,
    private mainSpinnerService: MainSpinnerService,
    private router: Router,
  ) {}

  /**
   * 2- دریافت لوکیشن
   */
  public async submitForm(
    vote: VoteSharedService,
    form: NgForm,
    isSaveTemp = false,
    timeIsEnded = false,
    isPartial = false,
    partialRegisterFormQuestionUniqueId: string = '',
    tenantPaymentGatewayId: string = '',
  ): Promise<void> {
    const currentSection = vote.sections[vote.currentSectionPage];
    await this.logicService.storeSection(currentSection, true);
    this.isSavingForm = true;
    // اگر زمان شرکت در نظرسنجی تمام شده بود و فرم قابل ثبت باشد ، دیگه اگر نتونست لوکیشن بگیره بیخیال بشود
    if (timeIsEnded || isPartial || vote.isPreviewMode || vote.pollData.isLocationNeededForVoter === false) {
      this.savePollToServerCheckRecording(
        vote,
        isSaveTemp,
        isPartial,
        partialRegisterFormQuestionUniqueId,
        tenantPaymentGatewayId,
      );
    } else {
      this.loadingGeoLocation = true;
      this.locationService
        .getPosition(isSaveTemp)
        .finally(() => (this.loadingGeoLocation = false))
        .then(
          (result) => {
            vote.userPosition = result;
            this.savePollToServerCheckRecording(
              vote,
              isSaveTemp,
              isPartial,
              partialRegisterFormQuestionUniqueId,
              tenantPaymentGatewayId,
            );
          },
          (error) => {
            this.isSavingForm = false;
            let allowRegisterWithoutGeoLocation = false;
            /**
             * وقتی که دریافت لوکیشن اجباری باشد ولی
             * در صورتی دکمه ثبت بدون لوکیشن را نمایش دهد که
             * - اگر اجباری نبود یا
             * - اگر اپ موبایل بود و فقط برای موبایل اجبار بود
             * اگر وب بود و فقط برای موبایل اجباری بود
             */
            if (AppConsts.isMobile) {
              allowRegisterWithoutGeoLocation =
                vote.pollData.locationRequeredForVoterType === LocationRequiredForVoterTypeEnum.NotRequired ||
                vote.pollData.locationRequeredForVoterType === LocationRequiredForVoterTypeEnum.RequiredForWeb;
            } else {
              allowRegisterWithoutGeoLocation =
                vote.pollData.locationRequeredForVoterType === LocationRequiredForVoterTypeEnum.NotRequired ||
                vote.pollData.locationRequeredForVoterType === LocationRequiredForVoterTypeEnum.RequiredForApp;
            }
            this.alert
              .show({
                title: AppConsts.isMobile ? '' : this.translateService.instant('GeoLocation'),
                html: `<pre class="text-start">${this.getErrorMessage(allowRegisterWithoutGeoLocation)}</pre>`,
                showCancelButton: timeIsEnded ? false : true,
                cancelButtonText: this.translateService.instant('Cancel'),
                showDenyButton: allowRegisterWithoutGeoLocation,
                denyButtonText: this.translateService.instant('RegisterWithoutGeoLocation'),
                showConfirmButton: true,
                confirmButtonText: this.translateService.instant('Retry'),
                allowEnterKey: false,
                allowOutsideClick: false,
              })
              .then((result: { isConfirmed: any; isDenied: any }) => {
                if (result.isConfirmed) {
                  this.submitForm(
                    vote,
                    form,
                    isSaveTemp,
                    timeIsEnded,
                    isPartial,
                    partialRegisterFormQuestionUniqueId,
                    tenantPaymentGatewayId,
                  );
                } else if (result.isDenied) {
                  this.savePollToServerCheckRecording(
                    vote,
                    isSaveTemp,
                    isPartial,
                    partialRegisterFormQuestionUniqueId,
                    tenantPaymentGatewayId,
                  );
                }
              });
          },
        );
    }
  }

  getErrorMessage(allowRegisterWithoutGeoLocation: boolean) {
    if (!AppConsts.isMobile) {
      return this.translateService.instant('NotPossibleToGetYourPosition');
    }
    let msgFa = `❗ موقعیت مکانی شناسایی نشد
برای تشخیص بهتر موقعیت شما، لطفاً مراحل زیر را بررسی و اجرا نمایید:

📡 به فضای باز (دور از سقف، درختان یا ساختمان‌های بلند) بروید تا دریافت سیگنال GPS بهبود یابد.
🔄 چند لحظه صبر کرده و دوباره تلاش نمایید.
📱 اطمینان حاصل کنید که سرویس مکان‌یابی (Location) دستگاه شما فعال است.
🔒 بررسی کنید که برنامه دسترسی به موقعیت مکانی را دارد:
    • وارد تنظیمات (⚙️ Settings) دستگاه موبایل خود شوید.
    • بخش برنامه ها (Apps یا Applications) را باز کنید.
    • برنامه پندارگان را انتخاب کنید.
    • روی گزینه مجوزها (Permissions) بزنید.
    • مطمئن شوید گزینه‌ی Location در حالت Allow only while using the app یا Allow all the time فعال است.
🚫 اطمینان حاصل کنید که حالت پرواز (Airplane Mode) یا فیلترشکن (VPN) غیرفعال باشد.
📶 به اینترنت پایدار و پرسرعت (ترجیحاً Wi-Fi یا 4G/5G) متصل شوید.`;

    if (allowRegisterWithoutGeoLocation) {
      msgFa += `
📍 توجه داشته باشید:
ثبت موقعیت مکانی برای این پروژه به‌صورت غیر اجباری و کاملاً به دلخواه شما می‌باشد.

در واقع، شما می‌توانید در صورت تمایل، این فرم را با استفاده از دکمه «ثبت بدون موقعیت مکانی» 📝 ثبت نمایید.
`;
    }

    let msgEn = `❗ Location Not Detected
To help the app detect your location more accurately, please check and follow these steps:

📡 Move to an open area (away from roofs, trees, or tall buildings) to improve GPS signal reception.
🔄 Wait a few moments and try again.
📱 Make sure your device’s Location Service is turned on.
🔒 Check that the app has Location Permission enabled:
    • Open ⚙️ Settings.
    • Go to Apps or Applications.
    • Select the app.
    • Tap Permissions.
    • Ensure Location is set to Allow only while using the app or Allow all the time.
🚫 Verify that Airplane Mode and VPN are turned off.
📶 Connect to a stable and fast internet connection (preferably Wi-Fi or 4G/5G).`;

    if (allowRegisterWithoutGeoLocation) {
      msgEn += `
📍 Please note:
Submitting your location for this project is optional and entirely up to you.

You may, if you wish, submit this form using the “Submit Without Location” 📝 button`;
    }
    if (['fa', 'fa-ir'].indexOf(this.translateService.currentLang?.toLowerCase()) > -1) {
      return msgFa;
    } else {
      return msgEn;
    }
  }

  /**
   * 3- بررسی فایل ضبط صدا برای ارسال به سرور
   */
  private savePollToServerCheckRecording(
    vote: VoteSharedService,
    isSaveTemp = false,
    isPartial = false,
    partialRegisterFormQuestionUniqueId: string,
    tenantPaymentGatewayId: string,
  ): void {
    if (
      this.voiceRecorderService.recording ||
      (vote.pollData.isRecordingEnable && !this.audioRecordFileId && !vote.isPreviewMode)
    ) {
      this.voiceRecorderService
        .stop({
          pollUniqueId: vote.pollData.uniqueId,
          formGuid: vote.formGuid,
          formChecksum: vote.formChecksum,
          voiceRecordToken: vote.voiceRecordToken,
        })
        .then((record) => {
          if (record.type === RecordedDeviceEnum.Web || record.type === RecordedDeviceEnum.KBrowser) {
            this.uploadRecordingFile(
              vote,
              record.audioBlob,
              isSaveTemp,
              isPartial,
              partialRegisterFormQuestionUniqueId,
              tenantPaymentGatewayId,
            );
          } else {
            this.audioRecordFileUniqueId = record.fileIdUnique ?? '';
            if (isSaveTemp) {
              this.saveTemp(vote);
            } else {
              this.savePollToServer(vote, isPartial, partialRegisterFormQuestionUniqueId, tenantPaymentGatewayId);
            }
          }
        });
    } else {
      if (isSaveTemp) {
        this.saveTemp(vote);
      } else {
        this.savePollToServer(vote, isPartial, partialRegisterFormQuestionUniqueId, tenantPaymentGatewayId);
      }
    }
  }

  /**
   *  ارسال اطلاعات به سرور
   */
  private async savePollToServer(
    vote: VoteSharedService,
    isPartial: boolean,
    partialRegisterFormQuestionUniqueId: string,
    tenantPaymentGatewayId: string,
  ): Promise<void> {
    this.isSavingForm = true;
    const postData = await this.converterDataServer.getDataForSave(
      this.logicService,
      false,
      isPartial,
      partialRegisterFormQuestionUniqueId,
      tenantPaymentGatewayId,
    );
    postData.voterDetail.voiceRecordFileIdUnique = [
      {
        fileId: this.audioRecordFileId,
        fileUniqueId: this.audioRecordFileUniqueId,
        order: 0,
      },
    ];
    vote.stopTimer();
    this.dataService
      .post<CreateOrEditVoterAndDetailsOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.savePoll, postData)
      .subscribe({
        next: (response) => {
          if (response.success === true) {
            this.sendExpressionsForTrack(vote, response.result.trackingCode);

            if (!vote.isPreviewMode) {
              this.setPollIdInCookie(vote.pollData.uniqueId);
            } else {
              this.isSavingForm = false;
            }
            // اگر ذخیره برای رفتن به درگاه پرداخت بود نباید فرم بسته شود - فقط باید سوالات قبل از آن غیر فعال شوند
            if (isPartial) {
              app.event.trigger(EventEnum.SaveVoteData + partialRegisterFormQuestionUniqueId, true);
              this.isSavingForm = false;
              return;
            }

            //اگر با کابروزر صدا ضبط می شد بعد از ارسال فایل صدا به سرور باید فایل از بروزر حذف شود
            if (vote.pollData.isRecordingEnable && AppConsts.isKBrowser && !vote.isPreviewMode) {
              appCommand.deleteVoiceFromClient(vote.formGuid);
            }

            this.router.navigate(['/' + AppConsts.tenancyName + '/submit-result'], {
              queryParams: {
                trackingCode: response.result.trackingCode,
                returnUrl: this.router.url,
                message: response.result.message,
                lang: vote.languageName,
              },
            });
          } else {
            if (isPartial) {
              app.event.trigger(EventEnum.SaveVoteDataOnError + partialRegisterFormQuestionUniqueId, true);
            }
            this.isSavingForm = false;
            this.alert.show({
              title: this.translateService.instant('Error'),
              html:
                '<pre>' +
                (response.error.message ?? this.translateService.instant('AnErrorOccurredOnTheServer')) +
                '</pre>',
              confirmButtonText: this.translateService.instant('Ok'),
            });
            vote.startTimer();
          }
        },
        error: (exp) => {
          if (isPartial) {
            app.event.trigger(EventEnum.SaveVoteDataOnError + partialRegisterFormQuestionUniqueId, true);
          }
          this.isSavingForm = false;
          vote.startTimer();

          if (exp.messageIsShowed) return;

          const msg = exp?.error?.message;
          let msgDetails = exp?.error?.details;
          let msgTitle = msg ?? this.translateService.instant('AnErrorOccurredOnTheServer');

          let erCode = exp?.error?.code ?? 0;

          this.alert
            .show({
              title: msgTitle,
              html: msgDetails ? '<pre>' + msgDetails + '</pre>' : '',
              showCancelButton: true,
              cancelButtonText: this.translateService.instant('Ok'),
              showConfirmButton:
                AppConsts.isMobile &&
                (erCode == MobileSpecificErrorCodes.AutoTimeDisabled ||
                  erCode == MobileSpecificErrorCodes.AutoTimeNotFound)
                  ? true
                  : false,
              confirmButtonText: this.translateService.instant('Setting'),
            })
            .then((rr: { isConfirmed: any }) => {
              // in xamarin
              if (rr.isConfirmed) {
                this.handleErrorCode(erCode);
              }
              // اگر پاسخی برای ثبت وجود نداشته باشد
              if (erCode === 1010) {
                this.closeWindow(vote);
              }
            });
        },
      });
  }

  /**
   * برای تنظیمات
   * هر مرورگر فقط یک بار می تواند در نظرسنجی شرکت کند
   */
  private setPollIdInCookie(pollUniqueId: string): void {
    let cookieData = localStorage.getItem('_ga2') || '';
    try {
      cookieData = JSON.parse(cookieData);
      if (Array.isArray(cookieData)) {
        if (cookieData.indexOf(pollUniqueId) === -1) {
          cookieData.push(pollUniqueId);
        }
        localStorage.setItem('_ga2', JSON.stringify(cookieData));
      } else {
        localStorage.setItem('_ga2', JSON.stringify([pollUniqueId]));
      }
    } catch (error) {
      localStorage.setItem('_ga2', JSON.stringify([pollUniqueId]));
    }
  }

  public handleErrorCode(errorCode: number): void {
    this.mainSpinnerService.showLoading = true;
    this.dataService
      .post(AppConsts.hybridUrl + AppConsts.pwaUrls.errorCodeResolver, {
        errorCode,
      })
      .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
      .subscribe(
        (resp) => {
          console.log('xamarin handle error code', resp);
        },
        (error) => {
          console.log('xamarin handle error code', error);
        },
      );
  }

  /**
   * آپلود صدای پرسشگر
   */
  private uploadRecordingFile(
    vote: VoteSharedService,
    file: any,
    isSaveTemp = false,
    isPartial = false,
    partialRegisterFormQuestionUniqueId: string,
    tenantPaymentGatewayId: string,
  ): void {
    this.uploadingRecordedFile = true;
    let token: any = '';
    this.uploadingLog = '';
    if (vote.voiceRecordToken) {
      token = vote.voiceRecordToken.uniqueId;
    }
    if (!file.name) {
      file.name = 'recorded_voice_' + vote.pollData.uniqueId + '.ogg';
    }
    let metadata = {
      name: file.name,
      filename: file.name,
      emptyMetaKey: '',
      size: file.size + '',
      formGuid: vote.formGuid,
      pollUniqueId: vote.pollData.uniqueId + '',
      idCode: vote.identificationCode + '',
      formUniqueId: vote.pollData.formUniqueId + '',
    };
    console.info('tus metadata:', metadata);
    // Create a new tus upload
    const upload = new Upload(file, {
      // Endpoint is the upload creation URL from your tus server
      endpoint: AppConsts.remoteBaseUrl + '/FileStorage_CDN',
      // Retry delays will enable tus-js-client to automatically retry on errors
      retryDelays: [0, 3000, 5000],
      // Attach additional meta data about the file for the server
      chunkSize: 10 * 1024 * 1024, // byte,//10Mb
      metadata,
      headers: {
        fileToken: token,
      },
      overridePatchMethod: true,
      httpStack: new ReplaceContentTypeHttpStack(),
      onBeforeRequest: (req) => {
        if (req.getURL().endsWith('FileStorage_CDN')) {
          req.setHeader('content-type', 'application/octet-stream');
        }
      },
      // Callback for errors which cannot be fixed using retries
      onError: (error) => {
        console.log('Failed because: ' + error);
        for (const key in localStorage) {
          if (key.includes('tus')) {
            localStorage.removeItem(key);
          }
        }
        this.notify.error(this.translateService.instant('UploadFailed'));
        this.uploadingRecordedFile = false;
        this.isSavingForm = false;
      },
      // Callback for reporting upload progress
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        this.uploadingRercordPercentage = +percentage;
        // console.log(this.item.answer[fileIndex]);
        // setTimeout(() => {
        //   currentFile.progress = 0;
        // }, 15000);
      },
      // Callback for once the upload is completed
      onSuccess: (payload: any) => {
        // console.log('Download %s from %s', (upload.file as any)?.name, upload.url);
        for (const key in localStorage) {
          if (key.includes('tus')) {
            localStorage.removeItem(key);
          }
        }
        this.uploadingRecordedFile = false;
        if (isSaveTemp) {
          this.saveTemp(vote);
        } else {
          this.savePollToServer(vote, isPartial, partialRegisterFormQuestionUniqueId, tenantPaymentGatewayId);
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
        this.uploadingLog += '<div class="text-danger">Error ' + status + ': ' + responseBody + '</div>';
        this.uploadingLog +=
          '<div class="text-primary">' + this.translateService.instant('RetryingToUploadFile') + '</div>';
        // For any other status code, tus-js-client should retry.
        return true;
      },
      onAfterResponse: (req: HttpRequest, res: HttpResponse) => {
        const fileaddressurl = req.getURL() + '/' + res.getHeader('fileaddressurl');
        this.audioRecordFileId = +res.getHeader('fileid')!;
        this.audioRecordFileUniqueId = res.getHeader('fileidunique')!;
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

  /**
   * ذخیره موقت
   * @returns
   */
  private saveTemp(vote: VoteSharedService) {
    if (this.savingTemp) {
      return;
    }
    this.savingTemp = true;
    this.saveTemporaryService
      .save(this.audioRecordFileUniqueId, this.audioRecordFileId)
      .then((result) => {
        this.notify.success(this.translateService.instant('SavedSuccessFully'));
        if (vote.pollData.isRecordingEnable && !vote.isPreviewMode) {
          this.voiceRecorderService.start({
            pollUniqueId: vote.pollData.uniqueId,
            formGuid: vote.formGuid,
            formChecksum: vote.formChecksum,
            resetRecordedData: true,
            voiceRecordToken: vote.voiceRecordToken,
          });
        }
      })
      .catch((exp) => {
        if (vote.pollData.isRecordingEnable && !vote.isPreviewMode) {
          this.voiceRecorderService.start({
            pollUniqueId: vote.pollData.uniqueId,
            formGuid: vote.formGuid,
            formChecksum: vote.formChecksum,
            resetRecordedData: false,
            voiceRecordToken: vote.voiceRecordToken,
          });
        }
        if (exp.messageIsShowed) return;
        const msg = exp?.error?.message;
        let msgDetail = msg ?? this.translateService.instant('AnErrorOccurredOnTheServer');
        this.notify.warning(msgDetail);
      })
      .finally(() => {
        this.savingTemp = false;
        this.isSavingForm = false;
        vote.startTimer();
      });
  }

  public closeWindow(vote: VoteSharedService, forceCloseWindow = false): void {
    let redirectUrl = vote.pollData.addressLink ?? '';
    if (vote.isPreviewMode) {
      return;
    }
    // Web
    if (!AppConsts.isMobile) {
      if (redirectUrl) {
        if (!redirectUrl.startsWith('[%') && !redirectUrl.startsWith('http') && !redirectUrl.startsWith('/')) {
          redirectUrl = '//' + redirectUrl;
        }
        if (redirectUrl.includes('[%')) {
          for (let v of vote.gvarList) {
            redirectUrl = redirectUrl.split('[%' + v.title + '%]').join(v.result);
          }
        }
        let queryParams = location.href.split('?');
        if (queryParams.length > 1) {
          if (redirectUrl.includes('?')) {
            redirectUrl += '&' + queryParams[1];
          } else {
            redirectUrl += '?' + queryParams[1];
          }
        }
      } else {
        if (forceCloseWindow) {
          this.publicService.closeWindow('', true);
        } else {
          let url = this.route.snapshot.queryParams['errorUrl'] || '';
          if (!url.startsWith('http') && !url.startsWith('/') && url != '') {
            url = '//' + url;
          }
          redirectUrl = url;
        }
      }
    }
    this.publicService.closeWindow(redirectUrl, true);
  }

  async getAnswers(vote: VoteSharedService): Promise<CreateVoterWithDetailsDto> {
    const currentSection = vote.sections[vote.currentSectionPage];
    await this.logicService.storeSection(currentSection, true);

    return this.converterDataServer.getDataForSave(this.logicService, true, false, '', '');
  }

  sendExpressionsForTrack(vote: VoteSharedService, trackingCode?: string) {
    const postData = new TrackExpressionInputDto();
    postData.formReservedGuid = vote.formGuid;
    postData.trackExpressionDetails = [];
    postData.identificationCode = vote.identificationCode;
    //  postData.dynamicDataCode=;
    postData.pollUniqueId = vote.pollData.uniqueId;
    postData.formUniqueId = vote.pollData.formUniqueId;
    postData.trackingCode = trackingCode;
    postData.tenantId = AppConsts.tenantId!;
    postData.voterSequantialUniqueId = vote.voterSequentialUniqueId;

    const formula = vote.formulaList.filter(
      (x) =>
        [
          ExpressionActionsEnum.Hide,
          ExpressionActionsEnum.Show,
          ExpressionActionsEnum.EndForm,
          ExpressionActionsEnum.SubmitForm,
          ExpressionActionsEnum.SetValid,
          ExpressionActionsEnum.SetInvalid,
        ].indexOf(x.actionType) > -1,
    );

    for (let item of formula) {
      const f = new TrackExpressionDetail({
        actionType: item.actionType,
        targetType: item.targetType,
        expressionUniqueId: item.uniqueId,
        targetKey: item.targetKey,
        expressionText: item.expressionText,
        expressionResult: item.result,
        expressionReplacedText: item.expressionReplacedText,
      });
      postData.trackExpressionDetails.push(f);
    }

    this.dataService.post<void>(AppConsts.apiBaseUrl + AppConsts.serverApis.trackExpression, postData).subscribe();
  }
}

/**
 * Determines the translated error message based on the HTTP response content
 * and status codes.
 *
 */
export function TranslateTUSresponseError(
  translate: TranslateService,
  httpResponseMessageContent: string,
  httpStatusCode?: number | null,
): string {
  // Initialize output
  let errorTranslatedString = '';

  // Prepare lowercase trimmed version of the message
  const msg = (httpResponseMessageContent || '').toLowerCase().trim();

  if (msg.startsWith('invalid metadata')) {
    if (msg.includes('maxsize')) {
      errorTranslatedString = translate.instant('FileUploadLocalizedError_MaxSize');
    } else if (msg.includes('minsize')) {
      errorTranslatedString = translate.instant('FileUploadLocalizedError_MinSize');
    } else if (msg.includes('contenttype')) {
      errorTranslatedString = translate.instant('FileUploadLocalizedError_ContentType');
    } else if (msg.includes('extension')) {
      errorTranslatedString = translate.instant('FileUploadLocalizedError_Extension');
    }
  } else if (msg.includes('blocked') || msg.includes('firewall')) {
    errorTranslatedString = translate.instant('FileUploadLocalizedError_FirewallError');
  } else if (msg.includes('not found')) {
    errorTranslatedString = translate.instant('FileUploadLocalizedError_NotFound');
  }
  if (httpStatusCode != null && httpStatusCode === 404) {
    // If a previous error was already set (shouldn't happen here, but kept for safety)
    if (errorTranslatedString.trim().length > 0) {
      errorTranslatedString += '  ';
    }
    errorTranslatedString += translate.instant('FileUploadLocalizedError_NotFound404');
  } else if (httpStatusCode != null && httpStatusCode === 500) {
    // If a previous error was already set (shouldn't happen here, but kept for safety)
    if (errorTranslatedString.trim().length > 0) {
      errorTranslatedString += '  ';
    }
    errorTranslatedString += translate.instant('FileUploadLocalizedError_FirewallError');
  }

  return errorTranslatedString;
}
