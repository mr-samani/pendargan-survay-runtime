import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'drop-down',
  templateUrl: './drop-down.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropDownComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DropDownComponent),
      multi: true,
    },
  ],
  styles: [
    `
      .form-control {
        min-width: 150px;
      }
    `,
  ],
})
export class DropDownComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
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

  constructor(injector: Injector) {
    super(injector);
  }

  // compareFn(c1: any, c2: any): boolean {
  //   return c1 && c2 ? c1.id === c2.id : c1 === c2;
  // }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  ngOnInit(): void {
    let validators = [checkRequiredDescription(this.item)];
    if (this.item.isRequired) {
      validators.push(Validators.required);
    }
    this.myControl.setValidators(validators);
    this.myControl.updateValueAndValidity();
  }

  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  selectionChange() {
    if (this._disabled) {
      return;
    }
    this.item.answer = this.myControl.value;
    this.logicService.changeAnswer(this.item).finally(() => {
      this._onChange(this.item.answer);
      this.myControl.updateValueAndValidity();
      this._onValidatorChange();
    });
  }

  onChangeDescription() {
    if (typeof this.item.descriptionAnswer === 'string') {
      this.item.descriptionAnswer = this.item.descriptionAnswer.trim();
    }
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
    // for update progress bar
    this.logicService.changeAnswer(this.item);
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
export function checkRequiredDescription(item: QuestionModel): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (
      item.showDescription &&
      item.hasDescription &&
      item.isDescriptionRequired &&
      isNullOrEmpty(item.descriptionAnswer)
    ) {
      return {
        errorOnRequiredDescrpition: true,
      };
    }
    return null;
  };
}
