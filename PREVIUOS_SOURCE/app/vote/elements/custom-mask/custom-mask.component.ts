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
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'custom-mask',
  templateUrl: './custom-mask.component.html',
  styleUrls: ['./custom-mask.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomMaskQuestionComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CustomMaskQuestionComponent),
      multi: true,
    },
  ],
})
export class CustomMaskQuestionComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  _disabled = false;
  @Input() set disabled(val: boolean) {
    this._disabled = val;
    if (this.myControl) {
      if (this._disabled) {
        this.myControl.disable();
      } else {
        this.myControl.enable();
      }
    }
  }
  previousValue = '';

  maxlength = 1000;
  minlength = 0;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.init();
  }

  init(): void {
    let validations: any[] = [];
    if (this.item.isRequired) {
      validations.push(Validators.required);
    }

    if (!isNullOrEmpty(this.item.minimumAnswer)) {
      validations.push(Validators.minLength(this.item.minimumAnswer!));
      this.minlength = this.item.minimumAnswer!;
    }
    if (!isNullOrEmpty(this.item.maximumAnswer)) {
      validations.push(Validators.maxLength(this.item.maximumAnswer!));
      this.maxlength = this.item.maximumAnswer!;
    }

    if (this.item.settings?.maskRegEx) {
      validations.push(Validators.pattern(this.item.settings.maskRegEx));
    }

    // Validation
    if (this.myControl) {
      this.myControl.setValidators(validations);
      this.myControl.updateValueAndValidity();
    }
  }
  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }
  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  onChange(): void {
    if (this.myControl.invalid) {
      this.item.answer = '';
      this.logicService.changeAnswer(this.item);
    } else {
      // اگر کاربر مقدار را تغییر داد دیگر مقدار پیش فرض نباید اعمال شود
      if (
        this.item.hasInitialValue &&
        this.item.isEditableInitialValue &&
        this.item.initialValue &&
        this.item.answer != this.myControl.value
      ) {
        this.item.hasInitialValue = false;
      }
      this.item.answer = this.myControl.value;
      this.logicService.changeAnswer(this.item);
    }
    this._onChange(this.myControl.value);
  }

  async openBarCodeReader() {
    if (this._disabled) {
      return;
    }
    const { BarCodeReaderComponent } = await import('../barcode-reader/barcode-reader.component');
    this.matDialog
      .open(BarCodeReaderComponent)
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.myControl.setValue(result);
          this.onChange();
        }
      });
  }
  clear() {
    if (this._disabled) {
      return;
    }
    this.myControl.reset();
    this.item.answer = '';
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }
}
