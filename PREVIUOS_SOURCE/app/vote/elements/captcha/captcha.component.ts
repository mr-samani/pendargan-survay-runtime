import {
  AfterViewInit,
  Component,
  Injector,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  forwardRef,
} from '@angular/core';
import { QuestionModel } from '@core/models/QuestionModel';
import {
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  AbstractControl,
  ControlValueAccessor,
  ValidationErrors,
  Validator,
  Validators,
  NgModel,
} from '@angular/forms';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { AppConsts } from '@core/app-consts';
import { CaptchaComponent } from './angular-captcha-bot-detect-lib/captcha.component';
import { isValidGuid } from '@core/helper/guid';
import { Subscription, finalize } from 'rxjs';
import { VoterAnswerDetailValidationTypeEnum } from '@core/models/backend-dto/VoterAnswerDetailValidationTypeEnum';
import { ValidateVoterAnswerDetailDataInputDto } from '@core/models/backend-dto/ValidateVoterAnswerDetailDataInputDto';
import { ValidateVoterAnswerDetailDataOutputDto } from '@core/models/backend-dto/ValidateVoterAnswerDetailDataOutputDto';
import { setInterval, clearInterval } from 'worker-timers';

@Component({
  standalone: false,
  selector: 'captcha-question',
  templateUrl: './captcha.component.html',
  styleUrls: ['./captcha.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CaptchaQuestionComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CaptchaQuestionComponent),
      multi: true,
    },
  ],
  encapsulation: ViewEncapsulation.None,
})
export class CaptchaQuestionComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, AfterViewInit, Validator
{
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  @ViewChild(CaptchaComponent, { static: true }) botDetect!: CaptchaComponent;
  timerForDeleteAttr?: any;
  reloadBtnDetect?: any;
  isChecking = false;
  isValid = false;
  checkingSubscription?: Subscription;
  constructor(injector: Injector) {
    super(injector);
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  ngOnInit(): void {
    this.botDetect.captchaEndpoint = AppConsts.apiBaseUrl + '/simple-captcha-endpoint.ashx';

    let validators = [];
    if (this.item.isRequired) {
      validators.push(Validators.required);
    }
    this.myControl.setValidators(validators);
    this.myControl.updateValueAndValidity();
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value) == false && isValidGuid(value)) {
      this.myControl.setValue(value);
      this.isValid = true;
    } else {
      this.myControl.reset();
      this.isValid = false;
    }
  }

  ngAfterViewInit(): void {
    this.timerForDeleteAttr = setInterval(() => {
      // console.log('try delete bot detect link');
      let lnk = this._document.querySelector(
        '#question-captcha-' + this.item.fid + ' a[href="//captcha.org/captcha.html?asp.net"]',
      );
      if (lnk) {
        lnk.remove();
        clearInterval(this.timerForDeleteAttr);
      }
    }, 10);

    this.reloadBtnDetect = setInterval(() => {
      const reloadBtn: HTMLAnchorElement | null = this._document.querySelector<HTMLAnchorElement>(
        '#question-captcha-' + this.item.fid + ' #mainCaptcha_ReloadLink',
      );
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          this.cancelCheck();
        });
        clearInterval(this.reloadBtnDetect);
      }
    }, 10);
  }

  /**
   * بعد از ریلود کردن تصویر کپچا
   * کپچا خالی می شود و فوکوس می شود
   * برای همین با زدن اینتر دوباره به سرور درخواست ارسال میشود
   * @param ev
   */
  checkKeyDown(ev: KeyboardEvent) {
    if (this.disabled) {
      return;
    }
    if (ev.key === 'Enter' && !this.botDetect.userEnteredCaptchaCode) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  reset() {
    if (this.botDetect) {
      this.botDetect.reloadImage();
    }
  }

  checkCaptcha(mainCaptchaUserInput: NgModel) {
    if (!mainCaptchaUserInput.value || this.isValid || this.disabled || !this.botDetect.userEnteredCaptchaCode) {
      return;
    }
    this.isChecking = true;
    const input: ValidateVoterAnswerDetailDataInputDto = {
      code: this.botDetect.userEnteredCaptchaCode,
      formQuestionUniqueId: this.item.uniqueId,
      formReserveGuid: this.vote.formGuid,
      validationKey: this.botDetect.captchaId,
      validationType: VoterAnswerDetailValidationTypeEnum.Captcha,
    };
    this.checkingSubscription = this.dataService
      .post<ValidateVoterAnswerDetailDataOutputDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.validateVoterAnswerDetailData,
        input,
      )
      .pipe(finalize(() => (this.isChecking = false)))
      .subscribe({
        next: (response) => {
          this.isChecking = false;
          this.isValid = response.result.validate;
          if (this.isValid) {
            this.myControl.setValue(response.result.validateGuid);
            this.setChanged();
          } else {
            this.notify.error(this.translateService.instant('InvalidCaptchaCode'));
            this.botDetect.reloadImage();
            this.cancelCheck();
          }
        },
        error: (er) => {
          this.botDetect.reloadImage();
          this.cancelCheck();
        },
      });
  }

  cancelCheck() {
    if (this.disabled) {
      return;
    }
    this.isChecking = false;
    this.isValid = false;
    this.myControl.reset();
    this.setChanged();
    if (this.checkingSubscription) {
      this.checkingSubscription.unsubscribe();
    }
  }

  setChanged() {
    this._onChange(this.myControl.value);
    this.logicService.changeAnswer(this.item);
    this.item.validationKey = this.botDetect.captchaId;
  }
}
