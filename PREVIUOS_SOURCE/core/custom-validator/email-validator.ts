import { Directive } from '@angular/core';
import { NG_VALIDATORS, Validator, FormControl } from '@angular/forms';

@Directive({
  standalone: false,
  // tslint:disable-next-line: directive-selector
  selector: '[emailValidate][formControlName],[emailValidate][formControl],[emailValidate][ngModel]',
  providers: [{ provide: NG_VALIDATORS, useExisting: CustomEmailDirective, multi: true }],
})
export class CustomEmailDirective implements Validator {
  validate(c: FormControl): { [key: string]: any } | null {
    const email = c.value;
    return /^[\w-.]+@([\w-]+\.)+[\w-]+$/.test(email) ? null : { invalid: true };
  }
}
