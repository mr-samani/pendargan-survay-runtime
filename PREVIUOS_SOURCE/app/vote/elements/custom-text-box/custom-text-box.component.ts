import { AfterViewInit, Component, ElementRef, forwardRef, Injector, Input, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { CustomFormValidators } from '@core/custom-validator/form-validation';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'custom-text-box',
  templateUrl: './custom-text-box.component.html',
  styleUrls: ['./custom-text-box.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomTextBoxComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CustomTextBoxComponent),
      multi: true,
    },
  ],
})
export class CustomTextBoxComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, AfterViewInit, Validator
{
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

  // @ViewChild('textBox') textBox!: ElementRef;
  minlength = 0;
  maxlength = 1000;
  @ViewChild('autosize') autosize?: CdkTextareaAutosize;
  constructor(
    injector: Injector,
    private customValidators: CustomFormValidators,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.init();
  }

  ngAfterViewInit(): void {
    // // dont use value change for auto save
    // if (this.textBox) {
    //   fromEvent(this.textBox.nativeElement, 'keyup')
    //     .pipe(
    //       // get value
    //       map((event: any) => {
    //         return event.target.value;
    //       }),
    //       debounceTime(500),
    //       distinctUntilChanged()
    //     )
    //     .subscribe((text: string) => {
    //       this.onChange();
    //     });
    // }

    this.myControl.valueChanges.pipe(debounceTime(500), distinctUntilChanged()).subscribe((_) => {
      this.autosize?.resizeToFitContent(true);
    });
  }

  init(): void {
    let validations: any[] = [];
    if (this.item.isRequired) {
      validations.push(Validators.required);
    }
    switch (this.item.questionType) {
      case FormQuestionTypesEnum.ShortText:
      case FormQuestionTypesEnum.LongText:
        if (!isNullOrEmpty(this.item.minimumAnswer)) {
          validations.push(Validators.minLength(this.item.minimumAnswer!));
          this.minlength = this.item.minimumAnswer!;
        }
        if (!isNullOrEmpty(this.item.maximumAnswer)) {
          validations.push(Validators.maxLength(this.item.maximumAnswer!));
          this.maxlength = this.item.maximumAnswer!;
        }
        break;
      case FormQuestionTypesEnum.NationalCode:
        validations.push(this.customValidators.checkNationalCode);
        this.maxlength = 10;
        break;
      case FormQuestionTypesEnum.Phone:
        validations.push(this.customValidators.checkPhoneNumber);
        this.maxlength = 11;
        break;
      case FormQuestionTypesEnum.PostalCode:
        validations.push(this.customValidators.checkPostalCode);
        this.maxlength = 10;
        break;
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
