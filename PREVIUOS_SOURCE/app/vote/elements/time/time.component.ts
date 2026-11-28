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
  selector: 'time',
  templateUrl: './time.component.html',
  styles: [
    `
      input[type='time']::-webkit-calendar-picker-indicator {
        background: none;
      }
      .input-group {
        min-width: 180px;
      }
      ::ng-deep .table-container time .input-group {
        width: 180px;
      }
      .ngx-mat-time-pcker {
        pointer-events: none;
        background-color: #ffffff21;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimeComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => TimeComponent),
      multi: true,
    },
  ],
})
export class TimeComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
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

  ngOnInit(): void {
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required]);
      this.myControl.updateValueAndValidity();
    }
    this.myControl.valueChanges.subscribe((v) => {
      this.timeChange();
    });
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  timeChange(): void {
    if (this._disabled) {
      return;
    }
    if (this.myControl.valid) {
      this.item.answer = this.myControl.value;
    }
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
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
