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
  selector: 'records-other-forms',
  templateUrl: './records-other-forms.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RecordsOtherFormsComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RecordsOtherFormsComponent),
      multi: true,
    },
  ],
})
export class RecordsOtherFormsComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required]);
      this.myControl.updateValueAndValidity();
    } else {
      this.myControl.setValidators([]);
      this.myControl.updateValueAndValidity();
    }
  }

  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  /**
   * for bind object in autocomplete
   * @param option any
   */
  displayFn(option: any): string {
    if (option && option.answerTitle) {
      return option.answerTitle;
    } else {
      return '';
    }
  }

  selectionChange() {
    if (this.disabled) {
      return;
    }
    this.item.answer = this.myControl.value;

    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }
}
