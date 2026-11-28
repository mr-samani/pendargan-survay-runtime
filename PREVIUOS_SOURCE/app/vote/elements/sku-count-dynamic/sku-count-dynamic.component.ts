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
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import {
  GetDynamicOptionAutoCompleteOutpotDto,
  QuestionJsonDataDto,
} from '@core/models/backend-dto/QuestionJsonDataDto';
import { QuestionModel } from '@core/models/QuestionModel';
import { SelectedSkuIteModel } from '@core/models/SelectedSkuIteModel';
import { SkuHistoryComponent } from './sku-history/sku-history.component';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { AppConsts } from '@core/app-consts';
import { EventEnum } from '@core/models/enums';
import { cloneDeep } from 'lodash-es';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { DynamicOptionAutoCompleteListInputDto } from '../../../../core/models/backend-dto/DynamicOptionAutoCompleteListInputDto';
import { DynamicDataResult } from '@core/models/DynamicDataResult';

@Component({
  standalone: false,
  selector: 'sku-count-dynamic',
  templateUrl: './sku-count-dynamic.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SkuCountDynamicComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SkuCountDynamicComponent),
      multi: true,
    },
  ],
})
export class SkuCountDynamicComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, AfterViewInit, Validator, OnDestroy
{
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
  loading = false;
  listCount = 0;
  filteredList?: Observable<QuestionJsonDataDto[]> = new Observable<QuestionJsonDataDto[]>();
  dynamicDataOptions: DynamicDataResult[] = [];

  defaultAnswerStateForClear = {};

  sumOfSelectedTotal = 0;

  // آخرین چیزی که بر اساس آن لیست مرتب شده است
  // برای اضافه کردن به لیست مرتب شده به این فیلد نیاز داریم
  lastSortField: any = 'id';
  lastSortIsAsc = true;

  showAdvanceButtons = true;

  answers: DynamicDataResult[] = [];
  loadInit?: Subscription;
  searchControl = new FormControl<SelectedSkuIteModel | undefined>(undefined);

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (!this.item.selectedList) {
      this.item.selectedList = [];
    }
    this.showAdvanceButtons = this.item.settings?.skuAdvanceButtons === true;

    if (
      this.item.dontShowAllWithoutSearch &&
      this.item.previousSecondaryFieldValueFilter != this.item.secondaryFieldValueFilter
    ) {
      this.appendToListAllDynamicData();
    }

    app.event.on(EventEnum.FilterDynamicDataEvent + this.item.uniqueId, () => {
      if (!this._disabled) {
        //this.searchControl.reset();
        // this.item.answer = '';
        this.ngAfterViewInit();
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  ngAfterViewInit(): void {
    this.filteredList = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this._filter(value)),
    );

    app.event.on(EventEnum.TriggerSkuDynamicEvent + this.item.uniqueId, () => {
      if (
        this.item.dontShowAllWithoutSearch &&
        this.item.previousSecondaryFieldValueFilter != this.item.secondaryFieldValueFilter
      ) {
        // this.searchControl.reset();
        if (this.loadInit) {
          this.loadInit.unsubscribe();
        }
        // this.item.answer = '';
        this.item.selectedList = [];
        this.appendToListAllDynamicData();
      }
    });
  }

  ngOnDestroy(): void {
    app.event.off(EventEnum.TriggerSkuDynamicEvent + this.item.uniqueId);
    app.event.off(EventEnum.FilterDynamicDataEvent + this.item.uniqueId);
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
      this.answers = cloneDeep(value);
    }
    this.updateSum();
  }

  /**
   * فیلتر بر روی لیست ها برای اتوکامپلیت
   * @param value  عبارت جستجو
   */
  private _filter(value: string | any): Observable<any> {
    if (typeof value === 'object' && value !== null) {
      value = ''; // value.answerTitle;
    }
    this.loading = true;
    let dynamicExpression = this.item.fieldValueFilter ?? '';
    const input: DynamicOptionAutoCompleteListInputDto = {
      dynamicDataUniqueId: this.item.dynamicDataUniqueId,
      fieldToSearchIn: dynamicExpression.trim() ? 'DynamicExpression' : '',
      fieldValueFilter: dynamicExpression,
      searchText: value ? value : '',
      resultsNumber: 500,
      formGuid: this.vote.formGuid,
      searchWithoutSpace: true,
      recordIdArrayToGet: undefined,
      secondaryFieldToSearchIn: undefined,
      secondaryFieldValueFilter: undefined,
    };
    return this.dataService
      .post<GetDynamicOptionAutoCompleteOutpotDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getDynamicOptionAutoCompleteList,
        input,
      )
      .pipe(
        map((response) => {
          this.loading = false;
          this.dynamicDataOptions = response.result.questionJsonDataList ?? [];
          this.listCount = response.result?.totalCount ?? 0;
          return this.dynamicDataOptions;
        }),
        catchError((error) => {
          this.handleApiError(error, false);
          this.loading = false;
          this.dynamicDataOptions = [];
          return of(this.dynamicDataOptions || []);
        }),
      );
  }

  /**
   * نمایش لیست محصولات قبلی
   */
  appendToListAllDynamicData(): void {
    this.loading = true;
    if (this.item.secondaryFieldValueFilter != this.item.previousSecondaryFieldValueFilter) {
      this.item.previousSecondaryFieldValueFilter = this.item.secondaryFieldValueFilter;
    }
    if (
      this.item.dontShowAllWithoutSearch &&
      this.item.previousSecondaryFieldValueFilter != this.item.secondaryFieldValueFilter
    ) {
      this.item.selectedList = [];
    }
    const valueFilter = this.item.secondaryFieldValueFilter;
    let recordIdArrayToGet: any[] = [];
    if (valueFilter) {
      recordIdArrayToGet = valueFilter.split(/،|,/).filter((x2: string) => x2);
      for (let i = recordIdArrayToGet.length - 1; i >= 0; i--) {
        recordIdArrayToGet[i] = recordIdArrayToGet[i].replace(/ /g, '');
        if (recordIdArrayToGet[i] === '') {
          recordIdArrayToGet.splice(i, 1);
        }
      }
    }
    const input: DynamicOptionAutoCompleteListInputDto = {
      dynamicDataUniqueId: this.item.dynamicDataUniqueId,
      fieldToSearchIn: '',
      fieldValueFilter: '',
      searchText: '',
      resultsNumber: 500,
      formGuid: this.vote.formGuid,
      searchWithoutSpace: true,
      recordIdArrayToGet,
      secondaryFieldToSearchIn: undefined,
      secondaryFieldValueFilter: undefined,
    };
    this.loadInit = this.dataService
      .post<GetDynamicOptionAutoCompleteOutpotDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getDynamicOptionAutoCompleteList,
        input,
      )
      .subscribe({
        next: (response) => {
          this.loading = false;
          let list = SelectedSkuIteModel.initList(response.result.questionJsonDataList ?? []);
          this.listCount = response.result?.totalCount;
          for (const s of list) {
            if (this.item.selectedList.findIndex((x) => x.identificationCode == s.identificationCode) == -1) {
              this.item.selectedList.push({
                ...s,
                quantity: 1,
                total: this.showAdvanceButtons ? 0 : (null as any),
                dynamicDataUniqueId: this.item.dynamicDataUniqueId!,
              });
            }
          }
          // set value
          for (let a of this.answers) {
            let finded = this.item.selectedList.findIndex((x) => x.identificationCode == a.identificationCode);
            if (finded > -1 && a.total != undefined) {
              this.item.selectedList[finded].total = +a.total;
            }
          }
          this.updateSum();

          this.sort('ordering', true);
        },
        error: (err) => {
          this.handleApiError(err, false);
          this.loading = false;
        },
      });
  }

  clearItem(trigger: MatAutocompleteTrigger, auto: MatAutocomplete): void {
    if (this._disabled) {
      return;
    }
    this.searchControl.reset(undefined);
    setTimeout(() => {
      auto.options.forEach((item) => {
        item.deselect();
      });
      trigger.openPanel();
    }, 100);
  }

  /**
   * for bind object in autocomplete
   * @param option any
   */
  displayFn(option: any): string {
    if (option && option.answerTitle) {
      return option.answerTitle;
    } else {
      return '';
    }
  }

  onChangeSelection(trigger: MatAutocompleteTrigger): void {
    const formValue = this.searchControl.value;
    if (!formValue || !formValue?.identificationCode || this._disabled) {
      return;
    }

    this.addToSelectedList(this.searchControl.value);
    this.searchControl.reset(undefined);
    this.logicService.changeAnswer(this.item, false);
    this.logicService.updateProgressBar();
  }

  /*------------------------------------------------------------------------*/
  addToSelectedList(dynamicItem?: SelectedSkuIteModel | null): void {
    if (!dynamicItem) return;
    const finded = this.item.selectedList.findIndex((x) => x.identificationCode === dynamicItem.identificationCode);
    if (finded >= 0) {
      this.notify.info(this.translateService.instant('ThisOptionIsExistInlist'));
    } else {
      dynamicItem.quantity = 1;
      dynamicItem.total = this.showAdvanceButtons ? 0 : (null as any);
      dynamicItem.history = [];
      this.appendToSelectedListWithSort(dynamicItem);
    }
    setTimeout(() => {
      this.scrollIntoView(this.item.fid, dynamicItem.identificationCode);
    }, 100);
  }

  /**
   * اضافه کردن به لیست سورت شده
   * @param dynamicItem آیتم
   */
  appendToSelectedListWithSort(dynamicItem: SelectedSkuIteModel): void {
    let index = this.item.selectedList.length;
    for (const [i, x] of this.item.selectedList.entries()) {
      if (
        this.lastSortIsAsc &&
        x[this.lastSortField as keyof Object] > dynamicItem[this.lastSortField as keyof Object]
      ) {
        index = i;
        break;
      }
      if (
        !this.lastSortIsAsc &&
        x[this.lastSortField as keyof Object] < dynamicItem[this.lastSortField as keyof Object]
      ) {
        index = i;
        break;
      }
    }
    this.item.selectedList.splice(index, 0, dynamicItem);
    this.updateSum();
  }

  deleteFromSelectedList(dynamicItem: SelectedSkuIteModel): void {
    this.alert
      .show({
        text: this.translateService.instant('AreYouSureDelete'),
        showConfirmButton: true,
        showCancelButton: true,
        confirmButtonText: this.translateService.instant('Ok'),
        cancelButtonText: this.translateService.instant('Cancel'),
        allowEnterKey: true,
        allowEscapeKey: true,
        allowOutsideClick: false,
      })
      .then((result) => {
        if (result.isConfirmed) {
          let found = this.item.selectedList.findIndex((x) => x.identificationCode == dynamicItem.identificationCode);
          if (found > -1) this.item.selectedList.splice(found, 1);
          this.updateSum();
        }
      });
  }

  /*------------------------------------------------------------------------*/

  increment(sku: SelectedSkuIteModel, txtQuantity: HTMLInputElement, txtTotal: HTMLInputElement): void {
    if (this._disabled) {
      return;
    }
    sku.history.push(sku.quantity);
    sku.total = +sku.total + +sku.quantity;
    sku.quantity = 1;
    this.changeDetectorRef.detectChanges();
    this.createAnim('animGreen', txtQuantity);
    this.createAnim('animGreen', txtTotal);
    this.updateSum();
    this.setFocusTextBox(sku.identificationCode);
  }
  decrement(sku: SelectedSkuIteModel, txtQuantity: HTMLInputElement, txtTotal: HTMLInputElement): void {
    if (sku.total <= 0 || this._disabled) {
      return;
    }
    sku.history.push(-sku.quantity);
    sku.total = +sku.total - +sku.quantity;
    sku.quantity = 1;
    if (sku.total < 0) {
      sku.total = 0;
    }
    this.changeDetectorRef.detectChanges();
    this.createAnim('animRed', txtQuantity);
    this.createAnim('animRed', txtTotal);
    this.updateSum();
    this.setFocusTextBox(sku.identificationCode);
  }
  onKeyDownQuesntity(
    $event: KeyboardEvent,
    sku: SelectedSkuIteModel,
    txtQuantity: HTMLInputElement,
    txtTotal: HTMLInputElement,
  ): void {
    if (this._disabled) {
      return;
    }
    if ($event.key === 'Enter') {
      $event.stopPropagation();
      $event.preventDefault();
      this.increment(sku, txtQuantity, txtTotal);
    }
  }

  createAnim(className: string, elem: Element, delay = 100): void {
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

  updateSum(): void {
    if (this._disabled) {
      return;
    }
    let sum = 0;
    for (const x of this.item.selectedList) {
      sum = sum + +x.total;
    }
    this.sumOfSelectedTotal = sum;
    this.item.answer = this.item.selectedList;
    this.myControl.setValue(this.item.answer ?? []);
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
  }

  scrollParentToChild(parentSelector: string, childSelecttor: string): void {
    const parent = this._document.querySelector(parentSelector);
    const child = this._document.querySelector(childSelecttor);
    if (!parent || !child) {
      return;
    }
    // Where is the parent on page
    const parentRect = parent.getBoundingClientRect();
    // What can you see?
    const parentViewableArea = {
      height: parent.clientHeight,
      width: parent.clientWidth,
    };
    // Where is the child
    const childRect = child.getBoundingClientRect();
    // Is the child viewable?
    const isViewable =
      childRect.top >= parentRect.top && childRect.bottom <= parentRect.top + parentViewableArea.height;

    // if you can't see the child try to scroll parent
    if (!isViewable) {
      // Should we scroll using top or bottom? Find the smaller ABS adjustment
      const scrollTop = childRect.top - parentRect.top;
      const scrollBot = childRect.bottom - parentRect.bottom;
      if (Math.abs(scrollTop) < Math.abs(scrollBot)) {
        // we're near the top of the list
        parent.scrollTop += scrollTop;
      } else {
        // we're near the bottom of the list
        parent.scrollTop += scrollBot;
      }
    }
    this.createAnim('anim-highlight-row', child, 1000);
  }

  scrollIntoView(questionfId: string, idCode: string | number): void {
    const rowSelector = '#sku_question_' + questionfId + ' #sku-row-' + idCode;
    const element = this._document.querySelector(rowSelector);
    const scrollOffset = 50;
    // console.log(element);
    if (element) {
      const elBound = element.getBoundingClientRect();
      const scrolY = window.scrollY;
      const scrolX = window.scrollX;
      const top = Math.abs(scrolY + elBound.top);
      const left = Math.abs(scrolX + elBound.left);
      let scrollableParent = element.closest('.mat-mdc-dialog-content') || window;
      scrollableParent.scrollTo({
        top: top - scrollOffset,
        behavior: 'smooth',
      });
      this.createAnim('anim-highlight-row', element, 1000);
    }
    this.setFocusTextBox(idCode);
  }

  selectText(ev: any): void {
    ev.currentTarget?.select();
  }
  /**
   * set textbox focus
   */
  setFocusTextBox(idCode: string | number): void {
    const rowSelector = '#sku_question_' + this.item.fid + ' #sku-row-' + idCode;
    const txtElInRow: any = this._document.querySelector(rowSelector + ' #skunumber' + idCode);
    if (txtElInRow) {
      txtElInRow.focus();
      txtElInRow.select();
    }
  }

  /**
   * مرتب سازی لیست انتخاب شده ها
   * @param sortField بر اساس چه فیلدی مرتب شود
   */
  sort(sortField: any, asc: boolean): void {
    if (!sortField) {
      return;
    }
    this.lastSortField = sortField;
    if (asc) {
      this.item.selectedList.sort((a: SelectedSkuIteModel, b: SelectedSkuIteModel) => {
        if (a[sortField as keyof Object] > b[sortField as keyof Object]) {
          return 1;
        } else if (a[sortField as keyof Object] < b[sortField as keyof Object]) {
          return -1;
        }
        return 0;
      });
    } else {
      this.item.selectedList.sort((a: SelectedSkuIteModel, b: SelectedSkuIteModel) => {
        if (a[sortField as keyof Object] < b[sortField as keyof Object]) {
          return 1;
        } else if (a[sortField as keyof Object] > b[sortField as keyof Object]) {
          return -1;
        }
        return 0;
      });
    }
  }

  onChangeTotal() {
    this.updateSum();
  }
}
