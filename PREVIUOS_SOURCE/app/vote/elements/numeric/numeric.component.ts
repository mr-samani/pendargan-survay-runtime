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

@Component({
  standalone: false,
  selector: 'numeric',
  templateUrl: './numeric.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NumericComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NumericComponent),
      multi: true,
    },
  ],
  styles: [
    `
      .is-disable {
        cursor: not-allowed;
        background: rgba(187, 187, 187, 0.4666666667);
      }
    `,
  ],
})
export class NumericComponent extends CustomControlBase implements ControlValueAccessor, Validator, OnInit {
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
  validations: any[] = [];
  maxlength = 500;
  useThousandsSeparator = false;
  isDecimal = false;
  maxDecimalDigit?: number;

  /** اگر باید غیر فعال  */
  disabledValue?: number;

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.init();
  }

  init(): void {
    if (this.item.isRequired) {
      this.validations.push(Validators.required);
    }

    if (this.item.minimumAnswer !== undefined && this.item.minimumAnswer !== null) {
      this.validations.push(Validators.min(this.item.minimumAnswer));
    }
    if (this.item.maximumAnswer !== undefined && this.item.maximumAnswer !== null) {
      this.validations.push(Validators.max(this.item.maximumAnswer));
    }

    // Validation
    if (this.myControl) {
      this.myControl.setValidators(this.validations);
      this.myControl.updateValueAndValidity();
    }

    if (this.item.answer) {
      this.myControl.setValue(this.item.answer);
    }
    if (this.item.settings?.thousandsSeparator) {
      this.useThousandsSeparator = true;
    }
    this.maxDecimalDigit = this.item.settings?.maxDecimalDigit;

    this.isDecimal = this.item.settings?.isDecimal === true;

    // this.myControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((newValue) => {
    //   this.onChange();
    // });

    // اگر غیر فعال شود ولیدیشن ها کار نخواهد کرد
    // if (this.item.isEditableInitialValue == false && this.item.hasInitialValue == true) {
    //   this.myControl.disable();
    // } else {
    //   this.myControl.enable();
    // }
    this.changeDetectorRef.detectChanges();
  }

  writeValue(value: any): void {
    if (value !== undefined && value !== '' && value !== null) {
      value = Number.parseFloat(value);
      if (Number.isNaN(value)) {
        value = '';
      }
      this.myControl.setValue(value);
    } else {
      this.myControl.setValue(value);
    }
    this.disabledValue = this.myControl.value;
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  onChange(): void {
    if (this._disabled) {
      return;
    }
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
    this.disabledValue = this.item.answer;
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
