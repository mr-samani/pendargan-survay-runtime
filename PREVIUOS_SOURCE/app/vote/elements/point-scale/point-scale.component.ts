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
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'point-scale',
  templateUrl: './point-scale.component.html',
  styleUrls: ['./point-scale.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PointScaleComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PointScaleComponent),
      multi: true,
    },
  ],
})
export class PointScaleComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;
  disabledByNoComment = false;
  steps: number[] = [];
  colors: string[] = [];
  isRtl = true;
  // عنصر وسط
  middleItem?: number;

  // only rgb
  startColor = '#0000ff'; // 'rgb(255,100,100)'; // red
  endColor = '#ff0000'; // 'rgb(100,255,100)'; // green

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.item.minimumAnswer = this.item.minimumAnswer === undefined ? 1 : this.item.minimumAnswer;
    this.item.maximumAnswer = this.item.maximumAnswer === undefined ? 10 : this.item.maximumAnswer;
    this.item.decimalStep = !this.item.decimalStep || this.item.decimalStep < 0 ? 1 : this.item.decimalStep;
    // ltr=>1,rtl=>2
    if (this.item.questionDirection === 1) {
      this.isRtl = false;
    } else {
      this.isRtl = true;
    }
    if (this.item.questionType == FormQuestionTypesEnum.NPS) {
      this.isRtl = this.languageService.isRtl;
    }

    for (let i = this.item.minimumAnswer; i <= this.item.maximumAnswer; i = i + this.item.decimalStep) {
      this.steps.push(i);
    }
    // تعداد فرد
    if (this.steps.length % 2 !== 0) {
      const x = (this.steps.length - 1) / 2;
      this.middleItem = x * this.item.decimalStep + this.item.minimumAnswer;
    } else {
      this.middleItem = undefined;
    }

    if (this.item.settings?.useGradientScaleColor) {
      this.colors = colorGenerator(this.steps.length);
      // console.log(this.colors);
    }
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required]);
      this.myControl.updateValueAndValidity();
    }
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value) == false) {
      this.myControl.setValue(+value);
      this.onChangeNoCommentOption();
    } else {
      this.myControl.reset();
    }
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  setAnswer(step: number): void {
    if (this.disabled || this.disabledByNoComment) {
      return;
    }
    this.item.answer = step;
    this.logicService.changeAnswer(this.item);
    this.myControl.setValue(this.item.answer);
    this._onChange(this.item.answer);
  }

  onChangeNoCommentOption() {
    if (this.disabled) {
      return;
    }
    if (this.item.settings?.noComment) {
      this.setAnswer(0);
      this.disabledByNoComment = true;
    } else {
      this.disabledByNoComment = false;
    }
  }

  clear() {
    if (this.disabled) {
      return;
    }
    this.myControl.reset();
    this.item.answer = '';
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }
}

export function getColor(value: number) {
  //value from 0 to 1
  var hue = ((1 - value) * 120).toString(10);
  return ['hsl(', hue, ',100%,50%)'].join('');
}

export function colorGenerator(len: number) {
  let result = [];
  for (let i = 0; i <= len; i++) {
    var value = i / len;
    result.unshift(getColor(value));
  }
  return result;
}
