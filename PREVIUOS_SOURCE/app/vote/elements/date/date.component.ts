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
import { DateTime } from 'luxon';

@Component({
  standalone: false,
  selector: 'date',
  templateUrl: './date.component.html',
  styles: [
    `
      .input-group {
        min-width: 180px;
      }
      ::ng-deep .table-container date .input-group {
        width: 180px;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DateComponent),
      multi: true,
    },
  ],
})
export class DateComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
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

  beforeDate: DateTime;
  afterDate: DateTime;
  constructor(injector: Injector) {
    super(injector);
    let now = DateTime.now();
    this.beforeDate = now.minus({ years: 200 });
    this.afterDate = now.plus({ years: 200 });
  }

  ngOnInit(): void {
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required]);
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

  dateChange(): void {
    if (this._disabled) {
      return;
    }
    if (this.myControl.valid) {
      this.item.answer = this.formatDate(this.myControl.value);
    } else {
      this.item.answer = '';
    }
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }

  formatDate(date: any): any {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) {
      month = '0' + month;
    }
    if (day.length < 2) {
      day = '0' + day;
    }

    return [year, month, day].join('-');
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
