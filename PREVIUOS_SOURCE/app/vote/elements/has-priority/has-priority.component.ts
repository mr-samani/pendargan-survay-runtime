import { CdkDragDrop, CdkDragStart, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { cloneDeep } from 'lodash-es';

@Component({
  standalone: false,
  selector: 'has-priority',
  templateUrl: './has-priority.component.html',
  styleUrls: ['./has-priority.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => HasPriorityComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => HasPriorityComponent),
      multi: true,
    },
  ],
})
export class HasPriorityComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  disableSelectOption = false;

  selectedList: AnswerModel[] = [];
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.item.minimumAnswer === undefined || this.item.minimumAnswer === null) {
      if (this.item.isRequired) {
        this.item.minimumAnswer = 1;
      } else {
        this.item.minimumAnswer = 0;
      }
    }
    if (this.item.maximumAnswer === undefined || this.item.maximumAnswer === null) {
      this.item.maximumAnswer = this.item.questionOptions.length;
    }

    for (const opt of this.item.questionOptions) {
      if (opt.selected === true) {
        this.addSelected(opt);
      }
    }

    let validators = [checkMinMaxSelection(this.item)];
    if (this.item.isRequired) {
      validators.push(Validators.required);
    }
    this.myControl.setValidators(validators);
    this.myControl.updateValueAndValidity();
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value)) value = '';
    this.myControl.setValue(value);
    let answer: string[] = [];
    if (typeof value == 'string') {
      answer = value.split(/،|,/).filter((x2: string) => !isNullOrEmpty(x2));
    } else if (Array.isArray(value)) {
      answer = value;
    }
    this.selectedList = [];
    for (let a of answer) {
      let finded = this.item.questionOptions.find((x) => x.uniqueId == a);
      if (finded) {
        finded.selected = true;
        this.selectedList.push(finded);
      }
    }

    if (this.selectedList.length >= (this.item.maximumAnswer ?? 0)) {
      this.disableSelectOption = true;
    } else {
      this.disableSelectOption = false;
    }
  }

  drop(event: CdkDragDrop<any[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    }

    this.checkAnswers();
  }

  changeSelectedItem(option: AnswerModel, checked: boolean): void {
    if (option.selected === checked || this.disabled) {
      return;
    }
    option.selected = checked;
    if (checked) {
      this.addSelected(option);
    } else {
      const optIndex = this.selectedList.findIndex((x) => x.uniqueId === option.uniqueId);
      this.selectedList.splice(optIndex, 1);

      const optIndex1 = this.item.questionOptions.findIndex((x) => x.uniqueId === option.uniqueId);
      this.item.questionOptions[optIndex1].selected = false;
    }

    this.checkAnswers();
  }

  addSelected(option: AnswerModel): void {
    const optIndex = this.selectedList.findIndex((x: any) => x.id === option.uniqueId);
    if (optIndex === -1) {
      this.selectedList.push(option);
    }
  }

  checkAnswers(): void {
    let min = this.item.maximumAnswer ?? 0;
    let max = this.item.maximumAnswer ?? 0;
    if (this.selectedList.length >= max) {
      this.disableSelectOption = true;
    } else {
      this.disableSelectOption = false;
    }

    if (this.selectedList.length >= min && this.selectedList.length <= max) {
      this.item.invalid = false;
    } else {
      this.item.invalid = true;
    }

    let val = [];
    for (let i = 0; i < this.selectedList.length; i++) {
      val.push(this.selectedList[i].uniqueId);
    }
    this.myControl.setValue(val.join(','));
    this.item.answer = val.join(',');
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }

  /**
   * firefox fix bug
   * در مرورگر فایرفاکس
   * هنگام جابجایی یک گزینه ، از حالت انتخاب خارج می شد
   */
  onmouseDown(ev: Event) {
    ev.stopPropagation();
    ev.preventDefault();
  }
}

export function checkMinMaxSelection(item: QuestionModel): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    let answer = [];
    if (control.value && typeof control.value == 'string') {
      answer = control.value.split(/،|,/).filter((x2: string) => x2);
    } else if (control.value && control.value.length) {
      answer = control.value;
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
