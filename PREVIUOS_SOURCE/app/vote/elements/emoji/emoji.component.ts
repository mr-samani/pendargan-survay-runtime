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
import { AnswerModel } from '@core/models/AnswerModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'emoji',
  templateUrl: './emoji.component.html',
  styleUrls: ['./emoji.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EmojiComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => EmojiComponent),
      multi: true,
    },
  ],
})
export class EmojiComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
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
    let validators = [];
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
    setTimeout(() => {
      this.item.answer = this.myControl.value;
      this.logicService.changeAnswer(this.item);
      this._onChange(this.item.answer);
    }, 10);
  }

  selectEmoji(opt: AnswerModel) {
    if (this.disabled) {
      return;
    }
    this.item.answer = opt.uniqueId;
    this.myControl.setValue(this.item.answer);
    this.selectionChange();
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
