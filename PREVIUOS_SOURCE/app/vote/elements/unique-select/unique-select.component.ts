import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ControlValueAccessor,
  ValidationErrors,
  Validator,
  Validators,
  ValidatorFn,
} from '@angular/forms';
import { AnswerModel } from '@core/models/AnswerModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'unique-select',
  templateUrl: './unique-select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UniqueSelectComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => UniqueSelectComponent),
      multi: true,
    },
  ],
})
export class UniqueSelectComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  constructor(injector: Injector) {
    super(injector);
  }
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

  writeValue(value: string | undefined): void {
    this.myControl.setValue(value);
    if (value !== undefined) {
      const opt = this.item.questionOptions.find((x) => x.uniqueId == value);
      if (opt) {
        this.selectionChange(opt, true);
      }
    }
  }

  selectionChange(option: AnswerModel, onLoadElement?: boolean) {
    if (this.disabled || option.disabled) {
      return;
    }
    setTimeout(() => {
      this.myControl.setValue(option.uniqueId);
      this.item.answer = option.uniqueId;
      this.item.questionOptions.map((x) => (x.selected = false));
      option.selected = true;
      this.logicService.changeAnswer(this.item, true, onLoadElement).finally(() => {
        this._onChange(this.item.answer);
        this.myControl.updateValueAndValidity();
        this._onValidatorChange();
      });
    }, 10);
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
    if (this.disabled) {
      return;
    }
    this.myControl.reset();
    this.item.answer = '';
    this.item.questionOptions.map((x) => (x.selected = false));
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
