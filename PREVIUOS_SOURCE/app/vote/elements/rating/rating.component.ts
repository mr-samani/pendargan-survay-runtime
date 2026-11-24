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
  selector: 'point-rating',
  templateUrl: './rating.component.html',
  styleUrls: ['./rating.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PointRatingComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PointRatingComponent),
      multi: true,
    },
  ],
})
export class PointRatingComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  list: number[] = [];
  readOnly = false;
  filled: number | undefined;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.item.minimumAnswer = this.item.minimumAnswer ?? 0;
    this.item.maximumAnswer = this.item.maximumAnswer ?? 100;
    this.item.answer = this.item.answer ?? 0;
    if (this.item.isEditableInitialValue === false && this.item.hasInitialValue === true) {
      this.readOnly = true;
    } else {
      this.readOnly = false;
    }
    if (this.item.isRequired) {
      this.myControl.setValidators([
        Validators.required,
        Validators.min(this.item.minimumAnswer),
        Validators.max(this.item.maximumAnswer),
      ]);
      this.myControl.updateValueAndValidity();
    }
    this.list = [];
    for (let i = this.item.minimumAnswer; i <= this.item.maximumAnswer; i++) {
      this.list.push(i);
    }
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    if (
      Number.isInteger(+value) &&
      +value >= +(this.item.minimumAnswer ?? 0) &&
      +value <= +(this.item.maximumAnswer ?? 0)
    ) {
      this.filled = +value;
      this.myControl.setValue(+value as any);
    } else {
      this.myControl.reset();
      this.filled = undefined;
    }
  }

  selectionChange(): void {
    this.item.answer = this.myControl.value;
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }

  onHover(ev: Event, point: number) {
    if (this.disabled) {
      return;
    }
    this.filled = point;
  }
  onMouseOut(ev: Event) {
    if (this.myControl.value) {
      this.filled = +this.myControl.value;
    } else {
      this.filled = undefined;
    }
  }
  onClick(point: number) {
    if (this.disabled) {
      return;
    }
    this.filled = point;
    this.myControl.setValue(point as any);
    this.selectionChange();
  }

  clear() {
    if (this.disabled) {
      return;
    }
    this.myControl.reset();
    this.item.answer = '';
    this.filled = undefined;
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }
}
