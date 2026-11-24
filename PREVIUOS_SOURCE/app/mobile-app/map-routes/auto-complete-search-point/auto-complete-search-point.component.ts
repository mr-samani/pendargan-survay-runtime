import { AfterViewInit, Component, forwardRef, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { MobileAppBaseComponent } from '@app/mobile-app/mobile-app-base-component';
import { RouteDataDto } from '../map-routes/route-dataDto';
import { debounceTime, distinctUntilChanged, Observable, of, startWith, switchMap } from 'rxjs';
import { RequireMatch } from '@core/custom-validator/requireMatch';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  selector: 'app-auto-complete-search-point',
  templateUrl: './auto-complete-search-point.component.html',
  styleUrls: ['./auto-complete-search-point.component.scss'],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutoCompleteSearchPointComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => AutoCompleteSearchPointComponent),
      multi: true,
    },
  ],
})
export class AutoCompleteSearchPointComponent
  extends MobileAppBaseComponent
  implements ControlValueAccessor, OnInit, Validator, AfterViewInit, OnDestroy
{
  @Input() allJsonData: RouteDataDto[] = [];

  myControl = new FormControl<RouteDataDto | undefined>(undefined);
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
  listCount = 0;
  filteredList = new Observable<RouteDataDto[]>();
  searchText = '';
  _onChange = (value: any) => {};
  _onTouched = () => {};
  _onValidatorChange = () => {};
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.myControl.setValidators([RequireMatch]);
    this.myControl.updateValueAndValidity();
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
  public isNullOrEmpty(value: any) {
    return isNullOrEmpty(value);
  }

  ngOnDestroy(): void {}

  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    return this.myControl.errors;
  }

  ngAfterViewInit(setValue = false): void {
    this.filteredList = this.myControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this._filter(value, setValue)),
    );
  }

  /**
   * فیلتر بر روی لیست ها برای اتوکامپلیت
   * @param value  عبارت جستجو
   */
  private _filter(value: string | RouteDataDto | null | undefined, setValue = false): Observable<RouteDataDto[]> {
    if (typeof value === 'object' || isNullOrEmpty(value)) {
      value = '';
    }
    value = typeof value == 'string' ? value.toLowerCase() : value + '';
    this.searchText = value;
    const result = this.allJsonData.filter((x) => {
      return (
        x.searchKeyData?.toLowerCase()?.includes(value) ||
        x.identificationCode?.includes(value) ||
        x.gisData?.some((f) => f.value?.toLowerCase().includes(value))
      );
    });
    this.listCount = result.length;
    return of(result);
  }

  clearItem(trigger: MatAutocompleteTrigger, auto: MatAutocomplete): void {
    if (this._disabled) {
      return;
    }
    this.myControl.reset(undefined);
    // setTimeout(() => {
    //   auto.options.forEach((item) => {
    //     item.deselect();
    //   });
    //   trigger.openPanel();
    // }, 100);
    this._onChange(this.myControl.value);
  }

  /**
   * for bind object in autocomplete
   * @param option RouteDataDto
   */
  displayFn(option: RouteDataDto): string {
    if (option && option.searchKeyData) {
      return option.searchKeyData;
    } else {
      return '';
    }
  }

  onChangeSelection(): void {
    if (this._disabled) {
      return;
    }
    this._onChange(this.myControl.value);
  }

  // onKeyPress(ev: KeyboardEvent, trigger: MatAutocompleteTrigger): void {
  //   if (ev.key === 'Enter') {
  //     ev.stopPropagation();
  //     ev.preventDefault();
  //     this.control.setValue(trigger.activeOption?.value);
  //   }
  // }
}
