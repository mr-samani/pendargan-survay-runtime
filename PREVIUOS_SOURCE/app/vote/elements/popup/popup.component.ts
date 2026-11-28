import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { SectionDialogComponent } from './section-dialog/section-dialog.component';

@Component({
  standalone: false,
  selector: 'popup',
  templateUrl: './popup.component.html',
  styles: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PopupComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PopupComponent),
      multi: true,
    },
  ],
})
export class PopupComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;
  formSectionUniqueId?: string;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (!this.item.description) {
      this.item.description = this.translateService.instant('ViewForm');
    }
    if (this.item.settings) {
      this.formSectionUniqueId = this.item.settings.formSectionUniqueId;
    }
    this.item.isRequired = this.checkChildHasRequiredQuestion();
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required]);
    }
    if (this.checkChildHasInvalidQuestion()) {
      this.myControl.reset();
    } else {
      this.myControl.setValue(true);
    }
    this.myControl.updateValueAndValidity();
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    //   this.myControl.setValue(value);
  }

  openPopup() {
    if (this.disabled) {
      return;
    }
    this.matDialog
      .open(SectionDialogComponent, {
        data: <{ parent: QuestionModel; formSectionUniqueId: string }>{
          parent: this.item,
          formSectionUniqueId: this.formSectionUniqueId,
        },
        width: '80vw',
      })
      .afterClosed()
      .subscribe((dialogResult: { formValid: boolean; result: QuestionModel[] }) => {
        if (dialogResult) {
          if (dialogResult.formValid) {
            this.myControl.setValue(true);
          } else {
            this.myControl.reset();
          }
          this._onChange(this.myControl.value);
        }
      });
  }

  /**
   * بررسی وجود پرسش اجباری در سکشن
   */
  checkChildHasRequiredQuestion(): boolean {
    const childList = this.vote.questionList.filter(
      (x) =>
        x.formSectionUniqueId == this.formSectionUniqueId &&
        x.isRequired &&
        x.hasVisibleQuestionOrOption &&
        !x.dontShow,
    );
    return childList.length > 0;
  }

  /**
   * بررسی پرسش با پاسخ نا معتبر در سکشن
   */
  checkChildHasInvalidQuestion(): boolean {
    // اگر سکشن از نوع دیالوگ اصلا وجود نداشت این پرسش اجباری نباید باشد
    const section = this.vote.sections.find((x) => x.uniqueId == this.formSectionUniqueId && x.isPopUp);
    if (!section) {
      return false;
    }
    const childList = this.vote.questionList.filter(
      (x) =>
        x.formSectionUniqueId == this.formSectionUniqueId &&
        (x.invalid || (x.isRequired && !x.answer)) &&
        x.hasVisibleQuestionOrOption &&
        !x.dontShow,
    );
    return childList.length > 0;
  }
}
