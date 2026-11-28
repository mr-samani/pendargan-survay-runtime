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
  selector: 'multi-select',
  templateUrl: './multi-select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true,
    },
  ],
})
export class MultiSelectComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
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
    let validators = [checkMinMaxSelection(this.item), checkRequiredDescription(this.item)];
    if (this.item.isRequired) {
      validators.push(Validators.required);
    }
    this.myControl.setValidators(validators);
    this.myControl.updateValueAndValidity();
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value)) value = '';
    this.myControl.setValue(value);
    let answer: string[] = value.split(/،|,/)?.filter((x2: string) => !isNullOrEmpty(x2)) || [];
    for (let opt of this.item.questionOptions) {
      opt.selected = answer.findIndex((x) => x == opt.uniqueId) > -1;
    }
  }

  selectionChange(question: QuestionModel, answerUniqueId: string) {
    setTimeout(() => {
      let val = [];
      for (let i = 0; i < question.questionOptions.length; i++) {
        if (question.questionOptions[i].selected) {
          val.push(question.questionOptions[i].uniqueId);
          this.item.questionOptions[i].selected = true;
        } else {
          this.item.questionOptions[i].selected = false;
        }
      }
      this.myControl.setValue(val.join(','));
      this.item.answer = val.join(',');
      this.logicService.changeAnswer(this.item).finally(() => {
        this._onChange(this.item.answer);
        this.myControl.updateValueAndValidity();
        this._onValidatorChange();
      });
    }, 10);
  }

  onChangeDescription() {
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
    // for update progress bar
    this.logicService.changeAnswer(this.item);
  }
}

export function checkMinMaxSelection(item: QuestionModel): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    let answer = [];
    if (control.value) {
      answer = control.value.split(/،|,/).filter((x2: string) => x2);
    }
    if (item.minimumAnswer && answer?.length < item.minimumAnswer) {
      return { min: true };
    }
    if (item.maximumAnswer && answer?.length > item.maximumAnswer) {
      return { max: true };
    }
    return null;
  };
}

export function checkRequiredDescription(item: QuestionModel): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const requiredDescription = item.questionOptions.filter(
      (x) =>
        x.selected &&
        x.hasDescriptiveAnswer &&
        x.requiredDescription &&
        (isNullOrEmpty(x.answerDescription) || x.answerDescription?.trim() == ''),
    );

    if (requiredDescription.length > 0) {
      return {
        errorOnRequiredDescrpition: true,
      };
    }
    return null;
  };
}
