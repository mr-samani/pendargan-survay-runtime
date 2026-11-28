import { Injector } from '@angular/core';
import { FormControl } from '@angular/forms';
import { VoteBaseComponent } from '../vote-base.component';

export abstract class CustomControlBase extends VoteBaseComponent {
  _onChange = (value: any) => {};
  _onTouched = () => {};
  _onValidatorChange = () => {};
  myControl = new FormControl();
  constructor(injector: Injector) {
    super(injector);
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  registerOnValidatorChange(fn: any): void {
    this._onValidatorChange = fn;
  }
}
