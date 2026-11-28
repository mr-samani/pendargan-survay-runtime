import { Component, OnInit, Injector, HostListener, ViewEncapsulation, ViewChild, NgZone } from '@angular/core';
import { VoteBaseComponent } from './vote-base.component';
import { PollTemporarySaveTypeEnum } from '@core/models/backend-dto/PollTemporarySaveTypeEnum';
import { GetAllFormDetailForViewOutputDto } from '@core/models/backend-dto/GetAllFormDetailForViewOutputDto';
import { PollAuthenticationResultEnum } from '@core/models/backend-dto/PollAuthenticationResultEnum';
import { GetPollGuidByTokenOutputDto } from '@core/models/backend-dto/GetPollGuidByTokenOutputDto';
import { GetPollGuidByVoterIdInputDto } from '@core/models/backend-dto/GetPollGuidByVoterIdInputDto';
import { GetPollGuidByTokenInputDto } from '@core/models/backend-dto/GetPollGuidByTokenInputDto';
import { VoteThemeService } from './services/theme.service';
import { finalize } from 'rxjs/operators';
import { AppConsts, MobileSpecificErrorCodes, MobileVoterSpecificErrorCodes } from '@core/app-consts';
import { TwoFactorAuthenticationDialogComponent } from './two-factor-authentication/two-factor-authentication.component';
import { CheckCaptchaService } from '../shared/ar-captcha/captcha.service';
import { HeaderComponent } from './header/header.component';
import { CaptchaInput } from '@core/models/backend-dto/CaptchaInput';
import { SaveTemporaryService } from './services/temporary.service';
import { ElasticService } from '../../elastic/setup';
import { SaveVoteService } from './services/save-vote.service';
import { VoteFlowDialog } from '@app/vote-flow/vote-flow.component';
import { startDevHotkey } from '@core/helper/devHostKey';
import { EventEnum } from '@core/models/enums';
import { DecodeString, EncodeString } from './helpers/atob-btoa';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { GetLostDataInputDto } from '@core/models/xamarin';

@Component({
  standalone: false,
  selector: 'app-vote',
  templateUrl: './vote.component.html',
  styleUrls: ['./vote.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class VoteComponent extends VoteBaseComponent implements OnInit {
  showWaitForRecordPermission = false;

  // وضعیت دریافت داده از سرور
  loadingInfo = '';

  loading = false;
  pollTokenLoading = false;

  // place
  places: any[] = [];
  loadingPlace = false;

  intervalShowTimer: any;
  intervalCount = 0;

  showFirstPage = false;

  isMobile = AppConsts.isMobile;
  /** اگر وضعیت تخصیص حاضر و همکاری بود می تواند بقیه فرم را مشاهده کند */
  presentAndCooperationAllocation = true;

  @ViewChild('appHeader', { static: false }) appHeader?: HeaderComponent;

  showLogButton = false;
  constructor(
    injector: Injector,
    private checkCaptchaService: CheckCaptchaService,
    public themeService: VoteThemeService,
    private saveTemporaryService: SaveTemporaryService,
    private saveVoteService: SaveVoteService,
    private elasticService: ElasticService,
    ngZone: NgZone,
  ) {
    super(injector);
    this.vote.questionList = [];
    this.logicService.pages = [];
    this.vote.resetService();

    startDevHotkey(ngZone).then((r) => {
      this.showLogButton = true;
    });

    this.handlePwaEvents();
  }

  /**
   * مشاهده پیش نمایش تنظیمات ظاهری
   */
  @HostListener('window:message', ['$event'])
  onThemePreviewMessage(event: any): void {
    const origin = event.origin || event.originalEvent?.origin; // For Chrome, the origin property is in the event.originalEvent object.
    // if (origin !== /*the container's domain url*/)
    //     return;
    if (typeof event.data === 'object' && event.data.call === 'sendValue') {
      // Do something with event.data.value;
      this.themeService.updateTheme(event.data.value?.pollTheme, event.data.value?.pollSetting);
      if (this.appHeader) {
        this.appHeader._mobileQueryListener();
      }
    }
    // widget send go back
    if (typeof event.data === 'object' && event.data.call === 'goBack') {
      this.alert
        .show({
          text: this.translateService.instant('DoYouWantLeave'),
          showConfirmButton: true,
          showCancelButton: true,
          confirmButtonText: this.translateService.instant('Ok'),
          cancelButtonText: this.translateService.instant('Cancel'),
        })
        .then((result) => {
          if (result.isConfirmed) {
            location.href = event.data.value?.address;
          }
        });
    }
  }

  ngOnInit(): void {
    const shortLink = this.route.snapshot.params['shortLink'];
    // edit voter
    const voterSequentialUniqueId = this.route.snapshot.params['voterId'];
    const pollUniqueId = this.route.snapshot.params['pollUniqueId'];
    // back from payment result
    const formReserveGuid = this.route.snapshot.params['formReserveGuid'];
    // back from view details by participant
    const formGuid = this.route.snapshot.params['formGuid'];
    if (AppConsts.isMobile) {
      this.getPollGuidByToken(shortLink ?? '73F55B4B', new CaptchaInput());
    } else {
      if (voterSequentialUniqueId) {
        this.vote.voterSequentialUniqueId = voterSequentialUniqueId;
        this.getPollGuidByVoterId(voterSequentialUniqueId, pollUniqueId);
      } else if (formGuid && shortLink) {
        if (AppConsts.tenantId) {
          this.initialize(formGuid);
        } else {
          // اگر صفحه رفرش شده بود باید فرم از اول باز شود
          if (AppConsts.tenancyName) {
            this.router.navigate(['/' + AppConsts.tenancyName + '/' + shortLink]);
          } else {
            this.router.navigate(['/' + shortLink]);
          }
        }
      } else if (shortLink) {
        this.getPollGuidByToken(shortLink, new CaptchaInput());
      } else if (formReserveGuid) {
        this.getPollGuidByToken(shortLink, new CaptchaInput(), formReserveGuid, false);
      } else {
        this.alert
          .show({
            title: this.translateService.instant('Error'),
            html:
              '<p>لینک شرکت در نظرسنجی صحیح نیست</p>' +
              '<p>The link to participate in the survey is not correct</p>' +
              '<p>الارتباط للمشاركة في الاستطلاع غير صحيح</p>',
            showCancelButton: true,
            showConfirmButton: false,
            cancelButtonText: this.translateService.instant('Ok'),
          })
          .then((result) => {
            this.publicService.closeWindow();
          });
      }
    }
  }

  /**
   * دریافت جی یو آیدی از روی لینک کوتاه
   * @param pollTokenValue لینک کوتاه
   */
  getPollGuidByToken(
    shortLink: string,
    captchaToken: CaptchaInput,
    selectedVoterForRejectByParticipant = '',
    isNewVoter = false,
  ): void {
    this.pollTokenLoading = true;
    this.loadingInfo = 'Receiving data...';
    // دریافت کد کار از ادرس
    let idCode = this.route.snapshot.queryParams['idCode'] || '';
    if (idCode) {
      this.vote.identificationCode = idCode;
    }
    const input: GetPollGuidByTokenInputDto = {
      pollTokenValue: shortLink,
      twoFactorAuthenticationCode: '',
      isSendTwoFactor: false,
      idCode,
      captchaResponse: captchaToken,
      selectedVoterForRejectByParticipant,
      isNewVoter,
    };
    this.dataService
      .post<GetPollGuidByTokenOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.getPollGuidByToken, input)
      .pipe(
        finalize(() => {
          this.pollTokenLoading = false;
        }),
      )
      .subscribe({
        next: (resp: { result: GetPollGuidByTokenOutputDto }) => {
          if (!resp.result || !resp.result.isSuccess) {
            const msg = resp?.result?.message;
            this.alert
              .show({
                title: msg,
                showConfirmButton: true,
                confirmButtonText: this.translateService.instant('Ok'),
              })
              .then((r) => {
                this.publicService.closeWindow(resp?.result?.redirectUrl);
              });
          } else {
            this.loadingInfo = '';
            this.vote.iPollHasUnlimitedParticipation = resp.result.iPollHasUnlimitedParticipation;
            this.vote.allowRejectResultByParticipant = resp.result.allowRejectResultByParticipant;
            this.vote.hasReRegistrationForm = resp.result.hasReRegistrationForm;
            AppConsts.tenantId = resp.result.tenantId;
            this.vote.languageName = resp.result.languageName;
            this.languageService.setPageLanguageAndDirection(resp.result.languageName);
            this.themeService.setMetaConfig(resp.result);
            this.vote.pollTitle = resp.result.title ?? '';
            this.vote.pollDescription = resp.result.description ?? '';
            this.vote.isPreviewMode = !resp.result.canSubmit;
            this.vote.allocationType = resp.result.allocationType;
            this.vote.titleButtonToParticipate = resp.result.titleButtonToParticipate ?? '';
            if (resp.result.showFirstPage && resp.result.canSubmit) {
              this.showFirstPage = true;
            }
            this.themeService.inittializeTheme(resp.result.jsonUIDesign);

            switch (resp.result.authResult) {
              case PollAuthenticationResultEnum.Success:
                this.initialize(resp.result.guid ?? '');
                break;
              case PollAuthenticationResultEnum.CaptchaRequired:
                this.getCaptcha(shortLink);
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
              case PollAuthenticationResultEnum.RedirectUrl:
                window.location.href = resp.result.redirectUrl ?? AppConsts.baseUiUrl;
                break;
              case PollAuthenticationResultEnum.RequiredLogin:
                const currentLocation = window.location.href;
                localStorage.setItem('returnUrl', currentLocation);
                this.translateService.get('YouMustLogInToYourAccount').subscribe((mustLoginMessage) => {
                  this.alert
                    .show({
                      text: mustLoginMessage,
                      confirmButtonText: this.translateService.instant('Ok'),
                    })
                    .then(() => {
                      window.location.href =
                        AppConsts.loginUrl + '?returnUrl=' + currentLocation + '&tenantId=' + resp.result.tenantId;
                    });
                });

                break;
              case PollAuthenticationResultEnum.RejectableVoterGuidNotProvided:
                this.vote.lastVoterOfParticipant = resp.result.lastVoterOfParticipant;
                if (AppConsts.tenancyName) {
                  this.router.navigate(['/' + AppConsts.tenancyName + '/last-voter-details/' + shortLink]);
                } else {
                  this.router.navigate(['/last-voter-details/' + shortLink]);
                }
                break;
              default:
                this.matDialog
                  .open(TwoFactorAuthenticationDialogComponent, {
                    data: {
                      shortLink,
                      result: resp.result,
                    },
                    panelClass: 'authentication-dialog',
                    closeOnNavigation: false,
                    disableClose: true,
                    direction: this.languageService.direction,
                  })
                  .afterClosed()
                  .subscribe((result: string) => {
                    if (result) {
                      this.initialize(result);
                    }
                  });
                break;
            }
          }
        },
        error: (exp: any) => {
          this.loadingInfo = '';
          if (exp.messageIsShowed) return;

          let msg = exp?.error?.message;
          let msgDetails = exp?.error?.details;
          let msgTitle = msg ?? this.translateService.instant('AnErrorOccurredOnTheServer');

          let erCode = exp?.error?.code ?? 0;
          if (erCode == MobileVoterSpecificErrorCodes.EnteredIdentityNotFound) {
            msgTitle = this.translateService.instant('XamarinYouAreNotAllowedToParticipate');
            msgDetails = this.translateService.instant('XamarinYouAreNotAllowedToParticipateDetails');
          }
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
                this.saveVoteService.handleErrorCode(erCode);
              } else {
                this.publicService.closeWindow();
              }
            });
        },
      });
  }

  /**
   * دریافت جی یو آیدی از روی آیدی پرسشنامه برای ویرایش
   *
   */
  getPollGuidByVoterId(voterSequentialUniqueId: string, pollUniqueId: string): void {
    this.pollTokenLoading = true;
    this.loadingInfo = 'Receiving data...';
    const input = new GetPollGuidByVoterIdInputDto({
      voterSequentialUniqueId,
      pollUniqueId,
    });
    this.dataService
      .post<GetPollGuidByTokenOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.GetPollGuidByVoterId, input)
      .pipe(
        finalize(() => {
          this.pollTokenLoading = false;
        }),
      )
      .subscribe({
        next: (resp: { result: GetPollGuidByTokenOutputDto }) => {
          this.loadingInfo = '';
          AppConsts.tenantId = resp.result.tenantId;
          this.vote.languageName = resp.result.languageName;
          this.languageService.setPageLanguageAndDirection(resp.result.languageName);
          this.themeService.setMetaConfig(resp.result);

          this.vote.pollTitle = resp.result.title ?? '';
          this.vote.pollDescription = resp.result.description ?? '';
          this.vote.isPreviewMode = !resp.result.canSubmit;
          this.vote.allocationType = resp.result.allocationType;
          if (resp.result.showFirstPage && resp.result.canSubmit) {
            this.showFirstPage = true;
          }

          this.themeService.inittializeTheme(resp.result.jsonUIDesign);
          this.initialize(resp.result.guid ?? '');
        },
        error: (er: any) => {
          this.loadingInfo = '';
          this.handleApiError(er, true);
        },
      });
  }

  /**
   * دریافت کد کپچا از گوگل
   */
  getCaptcha(shortLink: string): void {
    this.checkCaptchaService.execute('login', (token: CaptchaInput) => {
      this.getPollGuidByToken(shortLink, token, '', false);
    });
  }

  initialize(pollGuid: string): void {
    this.loading = true;
    // tslint:disable-next-line: no-console
    this.loadingInfo = 'Receiving data...';
    console.time('call poll api');
    this.dataService
      .post<GetAllFormDetailForViewOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.loadPoll, {
        guidValue: pollGuid,
      })
      .pipe(
        finalize(() => {
          this.loadingInfo = '';
        }),
      )
      .subscribe({
        next: async (resp: { result: GetAllFormDetailForViewOutputDto; responseHeader: Record<string, string> }) => {
          await this.handleResponseGetAllFormDetailForView(pollGuid, resp);
        },
        error: (er: any) => {
          // tslint:disable-next-line: no-console
          console.timeEnd('call poll api');
          this.handleApiError(er, true);
        },
      });
  }

  async handleResponseGetAllFormDetailForView(
    pollGuid: string,
    resp: {
      result: GetAllFormDetailForViewOutputDto;
      responseHeader: Record<string, string>;
    },
  ) {
    this.publicService.canClose = false;
    // tslint:disable-next-line: no-console
    console.timeEnd('call poll api');
    // tslint:disable-next-line: no-console
    console.time('initialize data');
    this.loadingInfo = 'Data preparation...';
    const response = resp.result;
    this.vote.formGuid = response.formGuid;
    this.vote.pollData = response.poll;
    // حالت پیش نمایش نبود و ذخیره موقت فعال بود
    if (resp.result.canSubmit && resp.result.poll.allowSaveTempVoter) {
      this.vote.autoSave = resp.result.poll.temporarySaveType === PollTemporarySaveTypeEnum.AutoSave;
      this.vote.saveTempVoter = resp.result.poll.temporarySaveType === PollTemporarySaveTypeEnum.UserSave;
    }
    this.vote.voiceRecordToken = response.voiceRecordToken;
    this.vote.formChecksum = response.formChecksum;
    if (!this.vote.pollData || this.vote.pollData === undefined) {
      this.alert
        .show({
          title: this.translateService.instant('Error'),
          text: this.translateService.instant('PollNotFound'),
          showConfirmButton: true,
          confirmButtonText: this.translateService.instant('Ok'),
          showCancelButton: false,
          allowEscapeKey: false,
          allowOutsideClick: false,
        })
        .then((result) => {
          this.publicService.closeWindow();
        });
      return;
    }
    this.vote.showPreviousFilledForms = response.showPreviousFilledForms === true;
    this.vote.oneQuestionPerPage = this.vote.pollData.showOneQuestionInAnyPage;
    this.vote.automaticGoToNextPage = this.vote.pollData.automaticGoToNextPage;
    this.vote.useManualCode = this.vote.pollData.useManualCode;
    this.vote.showQuestionNumberInPollingPage = this.vote.pollData.showQuestionNumberInPollingPage;
    this.logicService.initializeDemographicFields(response.demographyData);
    this.logicService.initializeSystemDataFields(response.systemData ?? []);
    if (!response.formQuestions || response.formQuestions.length == 0) {
      this.alert
        .show({
          title: response?.poll?.title,
          html: this.translateService.instant('NotExistAnyQuestion'),
          confirmButtonText: this.translateService.instant('Ok'),
        })
        .then((result) => {
          this.publicService.closeWindow();
        });
      throw new Error('Not Exist Any Question!');
    }
    await this.logicService.initializeQuestions(response.formQuestions as any).catch((er) => {
      this.alert
        .show({
          text: this.translateService.instant('QuestionOfFormsIsInvalid'),
          confirmButtonText: this.translateService.instant('Ok'),
        })
        .then(() => {
          this.publicService.closeWindow();
        });
    });
    await this.logicService.createSectionsByQuestionList(response.formSections ?? []);

    this.vote.pollRegionCapacityDto = response.pollRegionCapacityDto ?? [];

    let queryParams = this.route.snapshot.queryParams;
    await this.logicService.initializeGlobalVariables(response.formGlobalVariables ?? [], queryParams);

    await this.logicService.initializeFormula(response.formExpressions ?? []);
    const unexpectedlyClosedId = resp.responseHeader?.['x-unexpectedly-closed-id'];
    if (this.vote.questionList.length > 0) {
      // لود کردن داده ذخیره شده
      this.saveTemporaryService.loadVoter(pollGuid, this.vote.voterSequentialUniqueId, response.tempVoter, async () => {
        await this.logicService.loadQuestionsAnswersFromLocalStorage(false);
        await this.logicService.runFormula(this.vote.questionList[0].uniqueId, undefined, true);
        // جدا کردن پرسش ها بخش اول
        await this.logicService.getSectionQuestions(0, true);
        this.logicService.updateProgressBar();
      });
      // چک کردن ینکه در اپ موبایل قبلا فرم ناگهانی بسته شده یا خیر
      if (AppConsts.isMobile && resp.responseHeader && !isNullOrEmpty(unexpectedlyClosedId)) {
        this.loadPwaStopedData(unexpectedlyClosedId, resp.responseHeader?.['x-unexpectedly-closed-path']);
      }
    }

    if (this.vote.pollData.isRecordingEnable && !this.vote.isPreviewMode) {
      this.showWaitForRecordPermission = true;
      this.voiceRecorderService.recordingSubject.subscribe((result) => {
        this.voiceRecorderService.recording = result;
        if (result === true) {
          this.showWaitForRecordPermission = false;
          this.vote.startTimer();
        }
      });
      this.voiceRecorderService
        .start({
          pollUniqueId: this.vote.pollData.uniqueId,
          formGuid: this.vote.formGuid,
          formChecksum: this.vote.formChecksum,
          resetRecordedData: true,
          voiceRecordToken: this.vote.voiceRecordToken,
          unexpectedlyClosedId,
        })
        .catch((err) => {
          this.vote.showSubmitButton = false;
        });
    } else {
      this.vote.startTimer();
    }
    // tslint:disable-next-line: no-console
    console.timeEnd('initialize data');
    this.loadingInfo = '';
    this.loading = false;
    // this.changeDetectorRef.detectChanges();
    // console.table(this.vote.questionList);
    // console.log(this.vote.answerStates);
    if (this.vote.isPreviewMode == false && this.vote.pollData.isLocationNeededForVoter === true) {
      this.locationService.init(this.vote.pollData);
    }

    this.elasticService.updateUserInfo(response.demographyData);
  }

  /**
   * دریافت پاسخ های فرم برای اپ موبایل
   * - زمانی که اپ موبایل بسته میشود این ایونت صدا زده میشود و پاسخ هارا موقتا ذخیره میکند
   * @example await app.event.trigger('Pwa:GetAnswers')
   * @example await app.event.trigger('Pwa:LoadAnswers',savedData)
   */
  handlePwaEvents(): void {
    app.event.on(EventEnum.PwaGetAnswers, async () => {
      const currentSection = this.vote.sections[this.vote.currentSectionPage];
      await this.logicService.storeSection(currentSection);
      const s = JSON.stringify(this.logicService.pages);
      const data = EncodeString(encodeURIComponent(s));
      return data;
    });

    app.event.on(EventEnum.PwaLoadAnswers, async (savedData: string) => {
      try {
        if (!savedData || typeof savedData != 'string') {
          throw new Error('Invalid data to load!');
        }
        const d = DecodeString(savedData);
        const data = JSON.parse(decodeURIComponent(d));
        if (!data || Array.isArray(data) == false) {
          throw new Error('Invalid saved data to load answers!');
        }
        this.logicService.pages = data;
        await this.logicService.loadQuestionsAnswersFromLocalStorage();
        await this.logicService.runFormula(this.vote.questionList[0].uniqueId, undefined, true);
        this.vote.showPwaLoadAnswersInfo = true;
        this.changeDetectorRef.detectChanges();
        return 'Load data Completed.';
      } catch (error: any) {
        return error?.message ?? error;
      }
    });
  }

  loadPwaStopedData(id: string, path?: string) {
    this.mainSpinnerService.showLoading = true;
    const input = new GetLostDataInputDto();
    input.unexpectedlyClosedId = id;
    input.unexpectedlyClosedFilePath = path;
    this.dataService
      .post<string>(AppConsts.hybridUrl + AppConsts.pwaUrls.getLostData, input)
      .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
      .subscribe(async (savedData) => {
        try {
          this.mainSpinnerService.showLoading = true;
          console.time('LoadDataPwa');
          if (!savedData || !savedData.result || typeof savedData.result != 'string') {
            throw new Error('Invalid data to load!');
          }
          const d = DecodeString(savedData.result);
          const data = JSON.parse(decodeURIComponent(d));
          if (!data || Array.isArray(data) == false) {
            throw new Error('Invalid saved data to load answers!');
          }
          this.logicService.pages = data;
          await this.logicService.loadQuestionsAnswersFromLocalStorage();
          await this.logicService.runFormula(this.vote.questionList[0].uniqueId, undefined, true);
          this.vote.showPwaLoadAnswersInfo = true;
          this.changeDetectorRef.detectChanges();
          console.timeEnd('LoadDataPwa');
          this.mainSpinnerService.showLoading = false;
        } catch (error: any) {
          console.error(error?.message ?? error);
        }
      });
  }

  openLogDialog() {
    this.matDialog.open(VoteFlowDialog, {
      closeOnNavigation: true,
      disableClose: false,
      panelClass: 'custom-dialog',
      width: '98vw',
      minWidth: '98vw',
    });
  }
}
