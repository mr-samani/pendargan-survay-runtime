import { Directive, Injectable, Input } from '@angular/core';
import { NG_VALIDATORS, Validator, FormControl } from '@angular/forms';

@Directive({
  standalone: false,
  selector: '[customMin][formControlName],[customMin][formControl],[customMin][ngModel]',
  providers: [{ provide: NG_VALIDATORS, useExisting: CustomMinDirective, multi: true }],
})
export class CustomMinDirective implements Validator {
  @Input()
  customMin!: number;

  validate(c: FormControl): { [key: string]: any } | null {
    let v = c.value;
    return v < this.customMin ? { customMin: true } : null;
  }
}
//--------------------------------

@Directive({
  standalone: false,
  selector: '[customMax][formControlName],[customMax][formControl],[customMax][ngModel]',
  providers: [{ provide: NG_VALIDATORS, useExisting: CustomMaxDirective, multi: true }],
})
export class CustomMaxDirective implements Validator {
  @Input()
  customMax!: number;

  validate(c: FormControl): { [key: string]: any } | null {
    let v = c.value;
    return v > this.customMax ? { customMax: true } : null;
  }
}
