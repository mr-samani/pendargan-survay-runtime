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
import { AnswerModel } from '@core/models/AnswerModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { AppConsts } from '@core/app-consts';

@Component({
  standalone: false,
  selector: 'image-chooser',
  templateUrl: './image-chooser.component.html',
  styleUrls: ['./image-chooser.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ImageChooserComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => ImageChooserComponent),
      multi: true,
    },
  ],
})
export class ImageChooserComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;
  baseUrl = AppConsts.fileServerUrl;
  constructor(injector: Injector) {
    super(injector);
  }
  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  ngOnInit(): void {
    let validators =
      this.item.questionType === FormQuestionTypesEnum.MultiSelectWithImageOptions
        ? [checkMinMaxSelection(this.item)]
        : [];
    if (this.item.isRequired) {
      validators.push(Validators.required);
    }
    this.myControl.setValidators(validators);
    this.myControl.updateValueAndValidity();
  }

  writeValue(value: any): void {
    this.myControl.setValue(value);
    if (value && this.item.questionType === FormQuestionTypesEnum.MultiSelectWithImageOptions) {
      let answer = value.split(/،|,/).filter((x2: string) => x2);
      for (let a of answer) {
        this.item.questionOptions.forEach((opt) => {
          if (opt.uniqueId === a) {
            opt.selected = true;
          }
        });
      }
    }
  }

  selectionChange() {
    setTimeout(() => {
      this.logicService.changeAnswer(this.item);
      this._onChange(this.item.answer);
    }, 10);
  }

  selectImage(opt: AnswerModel) {
    if (opt.fullQuota || this.disabled) {
      return;
    }

    if (
      this.item.maximumAnswer &&
      !opt.selected &&
      this.item.selectedCount &&
      this.item.selectedCount >= this.item.maximumAnswer
    ) {
      return;
    }
    opt.selected = !opt.selected;
    if (this.item.questionType === FormQuestionTypesEnum.UniqueSelectWithImageOptions) {
      this.item.questionOptions.map((x) => (x.selected = false));
      opt.selected = true;
      this.item.answer = opt.uniqueId;
      this.myControl.setValue(this.item.answer);
      this.selectionChange();
    } else {
      let val = [];
      for (let i = 0; i < this.item.questionOptions.length; i++) {
        if (this.item.questionOptions[i].selected) {
          val.push(this.item.questionOptions[i].uniqueId);
          this.item.questionOptions[i].selected = true;
        } else {
          this.item.questionOptions[i].selected = false;
        }
      }
      this.myControl.setValue(val.join(','));
      this.item.answer = val.join(',');
      this.selectionChange();
    }
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
