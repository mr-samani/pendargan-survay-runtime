import {
  Component,
  ContentChildren,
  ElementRef,
  Injector,
  Input,
  OnInit,
  QueryList,
  ViewChildren,
  forwardRef,
} from '@angular/core';
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
import { finalize } from 'rxjs';
import { AppConsts } from '@core/app-consts';
import { VoteBaseComponent } from '../../vote-base.component';
import { RegionAutoCompleteComponent } from './region-auto-complete/region-auto-complete.component';
import { GetAllPollRegionCapacityChildByPollId } from '@core/models/backend-dto/GetAllPollRegionCapacityChildByPollId';
import { GetAllPollQuotaByGuidInputDto } from '@core/models/backend-dto/GetAllPollQuotaByGuidInputDto';

export interface ControlListModel {
  control: GetAllPollRegionCapacityChildByPollId | null;
  parentUniqueId: string;
  regions: GetAllPollRegionCapacityChildByPollId[];
}
@Component({
  standalone: false,
  selector: 'regions',
  templateUrl: './regions.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RegionsComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RegionsComponent),
      multi: true,
    },
  ],
})
export class RegionsComponent extends VoteBaseComponent implements ControlValueAccessor, OnInit, Validator {
  @Input() regions: GetAllPollRegionCapacityChildByPollId[] = [];
  @Input() label = this.translateService.instant('Place');
  @Input() disabled = false;

  // controlList: FormControl[]=[new FormControl('value')];
  @ViewChildren('regionChild') regionChild?: QueryList<RegionAutoCompleteComponent>;
  controlList: ControlListModel[] = [{ control: null, parentUniqueId: '', regions: [] }];
  control = new FormControl<string>('', [Validators.required]);
  loading = false;

  _onChange = (value: any) => {};
  _onTouched = () => {};
  _onValidatorChange = () => {};
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.regions.length === 0) {
      this.getFirstLevel();
    } else {
      this.controlList[0].regions = this.regions;
    }
  }

  getFirstLevel(): void {
    this.loading = true;
    const input = new GetAllPollQuotaByGuidInputDto();
    input.guid = this.vote.formGuid;
    input.parentRegionUniqueId = undefined;
    this.dataService
      .post<GetAllPollRegionCapacityChildByPollId[]>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getAllPollQuotaByGuid,
        input,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((response) => {
        this.loading = false;
        this.regions = response.result ? response.result : [];
        this.controlList[0].regions = this.regions;
      });
  }

  changeRegion(item: ControlListModel, index: number): void {
    for (let i = this.controlList.length - 1; i > index; i--) {
      this.controlList.splice(i, 1);
    }
    if (item.control && item.control.hasChildren) {
      let finded = false;
      for (const c of this.controlList) {
        if (c.parentUniqueId === item.control.uniqueId) {
          finded = true;
        }
      }

      if (finded === false) {
        this.controlList.push({ control: null, parentUniqueId: item.control.uniqueId, regions: [] });
      }
    } else if (item.control && item.control.hasCapacity === false) {
      this.notify.warning(this.translateService.instant('TheCapacityOfThisPlaceIsFull'));
      if (this.regionChild && this.regionChild.toArray()[index]) {
        this.regionChild.toArray()[index].clearItem();
      }
    }

    // وقتی سطح آخر انتخاب شد باید این دو خط زیر انجام شود
    if (this.controlList[this.controlList.length - 1].control) {
      this.control.setValue(this.controlList[this.controlList.length - 1].control?.uniqueId ?? '');
    } else {
      this.control.reset();
    }

    // set answer states
    this.vote.answerStates['Region.UniqueId'] = `"${this.control.value ? this.control.value.replace(/-/g, '') : ''}"`;
    if (this.vote.questionList.length > 0) this.logicService.runFormula(this.vote.questionList[0].uniqueId);
    this._onChange(this.control.value);
    this._onValidatorChange();
  }

  writeValue(value: string[]): void {
    //  console.log(value);
  }
  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    return control.errors;
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
}
