import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { QuestionModel } from '@core/models/QuestionModel';
import { SelectedSkuIteModel } from '@core/models/SelectedSkuIteModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { SkuHistoryComponent } from '../sku-count-dynamic/sku-history/sku-history.component';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'sku-count',
  templateUrl: './sku-count.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SkuCountComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SkuCountComponent),
      multi: true,
    },
  ],
})
export class SkuCountComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  showAdvanceButtons = true;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.showAdvanceButtons = this.item.settings?.skuAdvanceButtons === true;

    this.item.selectedList = [];
    for (const opt of this.item.questionOptions) {
      this.item.selectedList.push({
        identificationCode: opt.uniqueId,
        ordering: 0,
        questionOptionUniqueId: opt.uniqueId,
        answerTitle: opt.title,
        quantity: 1,
        total: this.showAdvanceButtons ? 0 : (null as any),
        history: [],
        answerTitleLower: '',
        answerTitleLowerNoSpace: '',
        dynamicDataUniqueId: '',
        jsonValuesDictionary: {},
        questionChilds: [],
        retaliVariables: {},
      });
    }
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    let errors: ValidationErrors | null;
    const countOfNoValue = this.item.selectedList.filter((x) => isNullOrEmpty(x.total)).length;
    if (this.item.isRequired && this.item.selectedList.length === 0) {
      errors = { min: true };
    } else if (this.item.isRequired && countOfNoValue > 0) {
      errors = { invalid: true };
    } else {
      errors = null;
    }
    this.myControl.setErrors(errors);
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    this.myControl.setValue(value);
    if (Array.isArray(value)) {
      this.item.selectedList = value;
    }
  }

  selectionChange() {
    if (this.disabled) {
      return;
    }
    this.myControl.setValue(this.item.selectedList as any);
    this._onChange(this.item.selectedList);
    this.logicService.changeAnswer(this.item, false);
    this.logicService.updateProgressBar();
    this._onValidatorChange();
  }

  /*------------------------------------------------------------------------*/

  increment(sku: SelectedSkuIteModel, txt: HTMLInputElement): void {
    if (this.disabled) {
      return;
    }
    sku.history.push(sku.quantity);
    sku.total = +sku.total + +sku.quantity;
    sku.quantity = 1;
    this.changeDetectorRef.detectChanges();
    this.createAnim('animGreen', txt);
    this.selectionChange();
  }
  decrement(sku: SelectedSkuIteModel, txt: HTMLInputElement): void {
    if (this.disabled) {
      return;
    }
    if (sku.total <= 0) {
      return;
    }
    sku.history.push(-sku.quantity);
    sku.total = +sku.total - +sku.quantity;
    sku.quantity = 1;
    if (sku.total < 0) {
      sku.total = 0;
    }
    this.changeDetectorRef.detectChanges();
    this.createAnim('animRed', txt);
    this.selectionChange();
  }

  createAnim(className: string, elem: HTMLInputElement, delay = 100): void {
    elem.classList.add(className);
    setTimeout(() => {
      elem.classList.remove(className);
    }, delay);
  }

  showHistory(sku: SelectedSkuIteModel): void {
    this.matDialog.open(SkuHistoryComponent, {
      data: {
        title: sku.answerTitle,
        history: sku.history,
      },
      minWidth: '250px',
      direction: this.languageService.direction,
    });
  }

  selectText(ev: any): void {
    ev.currentTarget?.select();
  }

  onKeyDownQuesntity($event: KeyboardEvent, sku: SelectedSkuIteModel, txt: HTMLInputElement): void {
    if (this.disabled) {
      return;
    }
    if ($event.key === 'Enter') {
      $event.stopPropagation();
      $event.preventDefault();
      this.increment(sku, txt);
    }
  }

  onChangeTotal() {
    this.selectionChange();
  }
}
