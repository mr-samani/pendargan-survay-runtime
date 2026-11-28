import { Component, OnInit, Injector, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import { CustomFormValidators } from '@core/custom-validator/form-validation';
import { PollAuthenticationResultEnum } from '@core/models/backend-dto/PollAuthenticationResultEnum';
import { GetPollGuidByTokenOutputDto } from '@core/models/backend-dto/GetPollGuidByTokenOutputDto';
import { GetPollGuidByTokenInputDto } from '@core/models/backend-dto/GetPollGuidByTokenInputDto';
import { AppConsts, HostEnum } from '@core/app-consts';
import { Logo } from '@core/helper/logo';
import { setInterval, clearInterval } from 'worker-timers';
import { CheckCaptchaService } from '@app/shared/ar-captcha/captcha.service';
import { VoteBaseComponent } from '../vote-base.component';
import { CaptchaInput } from '@core/models/backend-dto/CaptchaInput';
import { convertSecondstoTime } from '../helpers/time-string';
import { Location } from '@angular/common';
import { PollAuthenticationSettings } from '@core/models/backend-dto/PollAuthenticationSettings';

export enum TwoFactorStep {
  /**
   *  دریافت شماره موبایل یا کد ملی
   */
  GetMobileOrNationalCode,
  /**
   *  دریافت کد تائید
   */
  GetVerificationCode,
  /**
   *  انتخاب نظر سنجی
   */
  SelectPoll,
}

export interface DialogData {
  shortLink: string;
  result: GetPollGuidByTokenOutputDto;
}
@Component({
  standalone: false,
  selector: 'two-factor-authentication-dialog',
  templateUrl: './two-factor-authentication.component.html',
  styleUrls: ['./two-factor-authentication.component.scss'],
})
export class TwoFactorAuthenticationDialogComponent extends VoteBaseComponent implements OnInit {
  useArCaptcha = AppConsts.useArCaptcha;
  form: FormGroup;
  voteStep: TwoFactorStep = TwoFactorStep.GetMobileOrNationalCode;
  loading = false;

  timerCounter = 120;
  timerCounterString = '';
  resendTimerInterval: any;

  useMobileNumber = false;
  useUserCode = false;

  useCaptcha = false;
  shortLink = '';
  idCode = '';

  lengthOfSmsCode = 6;

  pollList: PollAuthenticationSettings[] = [];

  confirmCodeRandomName = '';
  verificationPhoneForView? = '';
  fieldName = '';
  authenticationFieldDescription = '';
  appLogo = '';
  baseAppUrl = AppConsts.baseUiUrl;
  showAppLogo = AppConsts.host === HostEnum.Pendargan;
  showScanQrCode = false;
  constructor(
    injector: Injector,
    private matDialogRef: MatDialogRef<TwoFactorAuthenticationDialogComponent>,
    // tslint:disable-next-line: variable-name
    @Inject(MAT_DIALOG_DATA) private _data: DialogData,
    private fb: FormBuilder,
    private checkCaptchaService: CheckCaptchaService,
    customValidator: CustomFormValidators,
    private location: Location,
  ) {
    super(injector);
    this.appLogo = Logo.appLogo(this.languageService.languageName);
    this.shortLink = _data.shortLink;
    this.useCaptcha = _data.result.hasCaptcha;
    this.authenticationFieldDescription = _data.result.authenticationFieldDescription ?? '';
    this.showScanQrCode = _data.result.useCameraCodeReaderInAuthenticate;
    this.form = this.fb.group({
      mobile: ['', [Validators.required, customValidator.checkMobileNumber]],
      userCode: ['', [Validators.required]],
      confirmationCode: [
        '',
        [Validators.required, Validators.minLength(this.lengthOfSmsCode), Validators.maxLength(this.lengthOfSmsCode)],
      ],
      selectedPoll: [''],
    });
    this.getConfirmationCodeIdNameRND();
    this.checkApiResult(_data.result);
  }

  ngOnInit(): void {
    // https://www.codeandweb.com/ngx-translate/documentation#instant
    this.translateService.get('IdentityCode').subscribe((val) => {
      this.fieldName = this._data.result.fieldName ?? val;
      if (!this.authenticationFieldDescription) {
        this.authenticationFieldDescription = this.useUserCode
          ? this.translateService.instant('EnterYour{fieldName}', { fieldName: this.fieldName })
          : this.translateService.instant('EnterYourMobileNumber');
      }
    });

    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
  }

  public get TwoFactorStep(): typeof TwoFactorStep {
    return TwoFactorStep;
  }

  /**
   * تایمر برای ارسال مجدد کد تائید
   */
  startTimer(): void {
    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
    }
    this.resendTimerInterval = setInterval(() => {
      this.timerCounter--;
      this.timerCounterString = convertSecondstoTime(this.timerCounter);
      if (this.timerCounter <= 0) {
        clearInterval(this.resendTimerInterval);
        this.timerCounter = 0;
      }
    }, 1000);
  }

  /**
   * ارسال کد تائید
   */
  sendVerificationCode(): void {
    if (this.useUserCode) {
      if (!this.form.get('userCode')?.value || this.form.get('userCode')?.invalid) {
        this.notify.warning(this.translateService.instant('EnterYour{fieldName}', { fieldName: this.fieldName }));
        return;
      } else {
        this.idCode = this.form.get('userCode')?.value;
      }
    } else if (this.useMobileNumber) {
      if (!this.form.get('mobile')?.value) {
        this.notify.warning(this.translateService.instant('EnterYourMobileNumber'));
        return;
      }
      this.idCode = this.form.get('mobile')?.value;
    }

    this.loading = true;

    const callBack = (token?: CaptchaInput) => {
      this.getPollGuid(this.shortLink, this.idCode, '', this.form.get('selectedPoll')?.value, token);
    };
    if (this.useCaptcha) {
      this.checkCaptchaService.execute('login', (token?: CaptchaInput) => {
        if (!token) {
          this.notify.warning(this.translateService.instant('ConfirmThatYouAreNotRobot'));
          this.loading = false;
          return;
        }
        callBack(token);
      });
    } else {
      callBack();
    }
  }

  /**
   *  ارسال مجدد کد تائید
   */
  resendVerificationCode(): void {
    if (this.timerCounter <= 0) {
      this.sendVerificationCode();
    }
  }

  /**
   * بررسی صحیح بودن کد تائید
   */
  checkVerificationCode(): void {
    if (!this.form.get('confirmationCode')?.value || this.form.get('confirmationCode')?.invalid) {
      this.notify.warning(this.translateService.instant('EnterYourVerificationCode'));
      return;
    }
    this.loading = true;
    const callBack = (token?: CaptchaInput) => {
      this.getPollGuid(
        this.shortLink,
        this.idCode,
        this.form.get('confirmationCode')?.value,
        this.form.get('selectedPoll')?.value,
        token,
      );
    };
    if (this.useCaptcha) {
      this.checkCaptchaService.execute('login', (token: CaptchaInput) => {
        if (!token) {
          this.notify.warning(this.translateService.instant('ConfirmThatYouAreNotRobot'));
          this.loading = false;
          return;
        }
        callBack(token);
      });
    } else {
      callBack();
    }
  }

  /**
   * اگر کاربر مجاز به شرکت در چند نظر سنجی بود
   * باید یکی را انتخاب کند
   */
  selectPollForContinue(): void {
    if (!this.form.get('selectedPoll')?.value) {
      this.notify.warning(this.translateService.instant('ChooseWhichPollYouWantToTake'));
      return;
    }
    this.loading = true;
    const callBack = (token?: CaptchaInput) => {
      this.getPollGuid(this.shortLink, this.idCode, '', this.form.get('selectedPoll')?.value, token);
    };
    if (this.useCaptcha) {
      this.checkCaptchaService.execute('login', (token: CaptchaInput) => {
        if (!token) {
          this.notify.warning(this.translateService.instant('ConfirmThatYouAreNotRobot'));
          this.loading = false;
          return;
        }
        callBack(token);
      });
    } else {
      callBack();
    }
  }

  /**
   * بررسی شرکت در نظرسنجی
   */
  getPollGuid(
    shortLink: string,
    idCode = '',
    verificationCode = '',
    pollUniqueId = '',
    captchaToken?: CaptchaInput,
    selectedVoterForRejectByParticipant = '',
    isNewVoter = false,
  ): void {
    // Build the new URL
    const newUrl = this.router
      .createUrlTree([], {
        queryParams: {
          idCode,
        },
        queryParamsHandling: 'merge', // Merge with existing query params
        preserveFragment: true,
      })
      .toString();

    // Update the browser's URL without reloading the page
    this.location.go(newUrl);
    this.loading = true;
    const input: GetPollGuidByTokenInputDto = {
      pollTokenValue: shortLink,
      twoFactorAuthenticationCode: verificationCode,
      isSendTwoFactor: idCode && !verificationCode && !pollUniqueId ? true : false,
      idCode: idCode,
      captchaResponse: captchaToken!,
      selectedVoterForRejectByParticipant,
      isNewVoter: isNewVoter,
    };
    this.dataService
      .post<GetPollGuidByTokenOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.getPollGuidByToken, input)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.checkCaptchaService.reset();
        }),
      )
      .subscribe({
        next: (resp) => {
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
            this.checkApiResult(resp.result);
          }
        },
        error: (er) => {
          this.loading = false;
          this.handleApiError(er, false);
        },
      });
  }

  /**
   * تنظیم مدت زمان پاسخ ارسال مجدد کد
   * و تعداد رقم کد تائید
   */
  verficationIsSendedUpdateFormValidation(result: GetPollGuidByTokenOutputDto): void {
    this.timerCounter = result.verificationCodeSeconds ? result.verificationCodeSeconds : 120;
    this.lengthOfSmsCode = result.verificationCodeNumberCount ? result.verificationCodeNumberCount : 6;
    this.form
      .get('confirmationCode')
      ?.setValidators([
        Validators.required,
        Validators.minLength(this.lengthOfSmsCode),
        Validators.maxLength(this.lengthOfSmsCode),
      ]);
    this.form.get('confirmationCode')?.updateValueAndValidity();
    if (result.twoFactorResults && result.twoFactorResults.length > 0) {
      this.verificationPhoneForView = result.twoFactorResults[0].twoFactorItem;
      if (result.twoFactorResults[0].message) this.notify.info(result.twoFactorResults[0].message);
    } else {
      this.verificationPhoneForView = '';
    }
    this.startTimer();
  }

  getConfirmationCodeIdNameRND(): void {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < 10; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    this.confirmCodeRandomName = 'confirmCode' + result;
  }

  checkApiResult(result: GetPollGuidByTokenOutputDto) {
    if (!result) {
      this.notify.error(this.translateService.instant('AnErrorOccurredOnTheServer'));
      return;
    }
    if (result && result.message) {
      this.notify.info(result.message);
    }
    this.vote.iPollHasUnlimitedParticipation = result.iPollHasUnlimitedParticipation;
    this.vote.allowRejectResultByParticipant = result.allowRejectResultByParticipant;
    this.vote.allocationType = result.allocationType;
    this.vote.titleButtonToParticipate = result.titleButtonToParticipate ?? '';

    switch (result.authResult) {
      case PollAuthenticationResultEnum.Success:
        this.matDialogRef.close(result.guid ?? '');
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
      case PollAuthenticationResultEnum.IdCodeRequired:
        this.useMobileNumber = false;
        this.useUserCode = true;
        this.voteStep = TwoFactorStep.GetMobileOrNationalCode;
        break;
      case PollAuthenticationResultEnum.TwoFactorAuthenticationCodeRequired:
      case PollAuthenticationResultEnum.TwoFactorAuthenticationRequired:
        this.useUserCode = false;
        this.useMobileNumber = false;
        // this.form.get('mobile')?.setValue(result.phoneNumber);
        // ارسال کد پیامکی انجام شده
        //if (userCode && !verificationCode) {
        this.verficationIsSendedUpdateFormValidation(result);
        //}
        this.voteStep = TwoFactorStep.GetVerificationCode;
        break;
      case PollAuthenticationResultEnum.MobileNumberRequired:
        this.useMobileNumber = true;
        this.useUserCode = false;
        this.voteStep = TwoFactorStep.GetMobileOrNationalCode;
        break;
      case PollAuthenticationResultEnum.PollIdOrTokenNotProvided:
        this.voteStep = TwoFactorStep.SelectPoll;
        this.pollList = result.availablePollSettings ?? [];
        break;
      case PollAuthenticationResultEnum.RedirectUrl:
        window.location.href = result.redirectUrl ?? AppConsts.baseUiUrl;
        break;
      case PollAuthenticationResultEnum.RequiredLogin:
        const currentLocation = window.location.href;
        localStorage.setItem('returnUrl', currentLocation);
        this.alert
          .show({
            text: this.translateService.instant('YouMustLogInToYourAccount'),
            confirmButtonText: this.translateService.instant('Ok'),
          })
          .then(() => {
            window.location.href =
              AppConsts.loginUrl + '?returnUrl=' + currentLocation + '&tenantId=' + result.tenantId;
          });
        break;
      case PollAuthenticationResultEnum.RejectableVoterGuidNotProvided:
        this.vote.lastVoterOfParticipant = result.lastVoterOfParticipant;
        if (AppConsts.tenancyName) {
          this.router.navigate(['/' + AppConsts.tenancyName + '/last-voter-details/' + this.shortLink]);
        } else {
          this.router.navigate(['/last-voter-details/' + this.shortLink]);
        }
        this.matDialogRef.close();
        break;
    }
  }

  async openBarCodeReader() {
    const { BarCodeReaderComponent } = await import('../elements/barcode-reader/barcode-reader.component');
    this.matDialog
      .open(BarCodeReaderComponent)
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.form.get('userCode')!.setValue(result);
          this.sendVerificationCode();
        }
      });
  }
}
