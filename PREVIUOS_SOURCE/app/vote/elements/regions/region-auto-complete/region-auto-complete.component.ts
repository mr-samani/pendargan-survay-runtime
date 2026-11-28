import { Component, Injector, Input, OnInit, forwardRef } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { Observable } from 'rxjs';
import { finalize, map, startWith } from 'rxjs/operators';
import { RequireMatch } from '@core/custom-validator/requireMatch';
import { AppConsts } from '@core/app-consts';
import { VoteBaseComponent } from '../../../vote-base.component';
import { GetAllPollRegionCapacityChildByPollId } from '@core/models/backend-dto/GetAllPollRegionCapacityChildByPollId';
import { GetAllPollQuotaByGuidInputDto } from '@core/models/backend-dto/GetAllPollQuotaByGuidInputDto';
@Component({
  standalone: false,
  selector: 'region-auto-complete',
  templateUrl: './region-auto-complete.component.html',
  styleUrls: ['./region-auto-complete.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RegionAutoCompleteComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RegionAutoCompleteComponent),
      multi: true,
    },
  ],
})
export class RegionAutoCompleteComponent extends VoteBaseComponent implements ControlValueAccessor, OnInit, Validator {
  @Input() regions: GetAllPollRegionCapacityChildByPollId[] = [];
  @Input() level = 0;
  @Input() label = this.translateService.instant('Place');
  @Input() required = true;
  @Input() parentUniqueId: string = '';

  noAnyData = false;
  loading = false;
  filteredRegions!: Observable<GetAllPollRegionCapacityChildByPollId[]>;

  control = new FormControl<GetAllPollRegionCapacityChildByPollId | null>(null, [RequireMatch]);
  _onChange = (value: any) => {};
  _onTouched = () => {};
  _onValidatorChange = () => {};
  constructor(injector: Injector) {
    super(injector);
    if (this.required) {
      this.control.setValidators([Validators.required, RequireMatch]);
    }
    this.control.updateValueAndValidity();
  }
  writeValue(obj: any): void {
    // console.log(this.control.value);
  }
  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    return this.control.errors;
  }
  registerOnChange(fn: any): void {
    this._onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    if (disabled) {
      this.control.disable();
    } else {
      this.control.enable();
    }
  }
  registerOnValidatorChange(fn: any): void {
    this._onValidatorChange = fn;
  }

  ngOnInit(): void {
    if (this.regions.length > 0 && !this.parentUniqueId) {
      this.setFilteredOption();
    } else {
      this.getRegions();
    }
    if (!this.label) {
      this.label = this.translateService.instant('Place');
    }

    // if (this.level == 0) {
    //   this.label = 'استان';
    // } else if (this.level == 1) {
    //   this.label = 'شهرستان';
    // }
    this.changeDetectorRef.detectChanges();
  }

  getRegions(): void {
    this.loading = true;
    const input = new GetAllPollQuotaByGuidInputDto();
    input.guid = this.vote.formGuid;
    input.parentRegionUniqueId = this.parentUniqueId;
    this.dataService
      .post<GetAllPollRegionCapacityChildByPollId[]>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getAllPollQuotaByGuid,
        input,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((response) => {
        this.regions = response.result ? response.result : [];
        this.setFilteredOption();
      });
  }

  setFilteredOption(): void {
    this.filteredRegions = this.control.valueChanges.pipe(
      startWith(''),
      map((value) => {
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          return value;
        } else {
          return '';
        }
      }),
      map((value) => {
        if (value) {
          return this._filter(value, this.regions);
        } else {
          if (this.regions.length === 0) {
            this.noAnyData = true;
          } else {
            this.noAnyData = false;
          }
        }
        return this.regions;
      }),
    );
  }
  /**
   * فیلتر بر روی لیست ها برای اتوکامپلیت
   * @param name  عبارت جستجو
   * @param regions   لیست
   */
  private _filter(name: string, regions: GetAllPollRegionCapacityChildByPollId[]): any[] {
    const filterValue = name.toLowerCase();
    const filteredValues = regions.filter((option) => option.title?.toLowerCase()?.indexOf(filterValue) === 0);
    if (filteredValues.length === 0) {
      this.noAnyData = true;
    } else {
      this.noAnyData = false;
    }
    return filteredValues;
  }

  clearItem(): void {
    this.control.reset();
    this.onChange();
  }

  /**
   * for bind object in autocomplete
   */
  displayFn(item: GetAllPollRegionCapacityChildByPollId): string {
    return item && item.title ? item.title : '';
  }

  onChange() {
    this._onChange(this.control.value);
  }
}
