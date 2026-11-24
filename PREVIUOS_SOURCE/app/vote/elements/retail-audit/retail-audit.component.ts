import { AfterViewInit, Component, forwardRef, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  ValidatorFn,
} from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import {
  GetDynamicOptionAutoCompleteOutpotDto,
  QuestionJsonDataDto,
} from '@core/models/backend-dto/QuestionJsonDataDto';
import { QuestionModel } from '@core/models/QuestionModel';
import {
  RetailAuditChildsComponent,
  IRetailAuditDialogData,
} from './retail-audit-childs/retail-audit-childs.component';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { AppConsts } from '@core/app-consts';
import { EventEnum } from '@core/models/enums';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { cloneDeep } from 'lodash-es';
import { SelectedSkuIteModel } from '@core/models/SelectedSkuIteModel';
import { DynamicOptionAutoCompleteListInputDto } from '@core/models/backend-dto/DynamicOptionAutoCompleteListInputDto';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'retail-audit',
  templateUrl: './retail-audit.component.html',
  styles: [
    `
      .sku-btn {
        color: #fff;
        border-radius: 50px;
        width: 32px;
        height: 32px;
        align-items: center;
        justify-content: center;
        display: flex;
      }
      .has-value-complete {
        background: #0087ff;
      }
      .has-value-incomplete {
        background: #ff9b00;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RetailAuditComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RetailAuditComponent),
      multi: true,
    },
  ],
})
export class RetailAuditComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, AfterViewInit, Validator, OnDestroy
{
  @Input() item!: QuestionModel;
  @Input() disabled = false;
  questionChilds: QuestionModel[] = [];

  loading = false;
  initLoading = false;
  listCount = 0;
  filteredList?: Observable<QuestionJsonDataDto[]> = new Observable<QuestionJsonDataDto[]>();
  dynamicDataOptions: SelectedSkuIteModel[] = [];

  // آخرین چیزی که بر اساس آن لیست مرتب شده است
  // برای اضافه کردن به لیست مرتب شده به این فیلد نیاز داریم
  lastSortField: any = 'id';
  lastSortIsAsc = true;
  loadInit?: Subscription;

  searchValue = new FormControl<SelectedSkuIteModel | undefined>(undefined);

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (!this.item.settings) {
      this.item.settings = {};
    }
    this.questionChilds = this.vote.questionList.filter((q) => q.parentUniqueId === this.item.uniqueId && q.isActive);
    if (!this.item.selectedList) {
      this.item.selectedList = [];
    }
    if (
      this.item.dontShowAllWithoutSearch &&
      this.item.previousSecondaryFieldValueFilter != this.item.secondaryFieldValueFilter
    ) {
      this.appendToListAllDynamicData();
    }

    this.filteredList = this.searchValue.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this._filter(value)),
    );

    this.myControl.setValidators([checkAllSkuFormIsValid(this.item)]);
    this.myControl.updateValueAndValidity();
  }

  ngAfterViewInit(): void {
    app.event.on(EventEnum.TriggerSkuDynamicEvent + this.item.uniqueId, () => {
      if (
        this.item.dontShowAllWithoutSearch &&
        this.item.previousSecondaryFieldValueFilter != this.item.secondaryFieldValueFilter
      ) {
        // this.myControl.reset();
        if (this.loadInit) {
          this.loadInit.unsubscribe();
        }
        this.item.answer = '';
        this.item.selectedList = [];
        this.appendToListAllDynamicData();
      }
    });
  }

  ngOnDestroy(): void {
    app.event.off(EventEnum.TriggerSkuDynamicEvent + this.item.uniqueId);
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    let errors: ValidationErrors | null = null;
    const countOfNoValue = this.item.selectedList.filter((x) => !x.formValid).length;
    if (this.item.isRequired && (this.item.selectedList.length === 0 || countOfNoValue > 0)) {
      errors = { invalid: true };
    }
    if (this.item.settings?.mandatoryCompletionAllRecords && this.item.selectedList.length < this.listCount) {
      errors = { ...errors, mandatoryCompletionAllRecords: true };
    }
    this.myControl.setErrors(errors);
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  async writeValue(value: any): Promise<void> {
    this.myControl.setValue(value);
    if (Array.isArray(value)) {
      this.item.selectedList = value;
      this.initLoading = true;
      // Validate formula for list
      for (let sku of this.item.selectedList) {
        if (sku.questionChilds && sku.questionChilds.length > 0) {
          // simulate sleep for test: await new Promise((r) => setTimeout(r, 1000));
          await this.logicService.resetFormulaResultInCurrentSection(this.item.formSectionUniqueId);
          await this.logicService.runFormula(sku.questionChilds[0].uniqueId, sku.questionChilds);
          const hasInvalid = sku.questionChilds.filter((x) => !x.answer && !x.dontShow && !x.endForm).length > 0;
          sku.formValid = !hasInvalid;
        }
      }
      this.initLoading = false;
    }
  }

  /**
   * فیلتر بر روی لیست ها برای اتوکامپلیت
   * @param value  عبارت جستجو
   */
  private _filter(value: string | any): Observable<any> {
    if (typeof value === 'object' && value !== null) {
      value = ''; // value.answerTitle;
    }
    let dynamicExpression = this.item.fieldValueFilter ?? '';
    const params: DynamicOptionAutoCompleteListInputDto = {
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
    this.loading = true;
    return this.dataService
      .post<GetDynamicOptionAutoCompleteOutpotDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getDynamicOptionAutoCompleteList,
        params,
      )
      .pipe(
        map((response) => {
          this.loading = false;
          this.listCount = response.result?.totalCount ?? 0;
          this.dynamicDataOptions = SelectedSkuIteModel.initList(response.result?.questionJsonDataList ?? []);
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
      this.item.answer = [];
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
    const params: DynamicOptionAutoCompleteListInputDto = {
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
        params,
      )
      .subscribe({
        next: (response) => {
          this.loading = false;
          let result = SelectedSkuIteModel.initList(response.result?.questionJsonDataList ?? []);
          this.listCount = response.result?.totalCount ?? 0;
          for (const s of result) {
            if (this.item.selectedList.findIndex((x) => x.identificationCode == s.identificationCode) == -1) {
              this.item.selectedList.push({ ...s, dynamicDataUniqueId: this.item.dynamicDataUniqueId! });
            }
          }
          this.item.answer = this.item.selectedList;
          this.logicService.updateProgressBar();
          this.sort('ordering', true);
        },
        error: (err) => {
          this.handleApiError(err, false);
          this.loading = false;
        },
      });
  }

  clearItem(trigger: MatAutocompleteTrigger, auto: MatAutocomplete): void {
    this.searchValue.reset(undefined);
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
    if (!this.searchValue.value || isNullOrEmpty(this.searchValue.value.identificationCode) || this.disabled) {
      return;
    }
    this.addToSelectedList(this.searchValue.value);
    this.searchValue.reset(undefined);
    this.logicService.updateProgressBar();
  }

  /*------------------------------------------------------------------------*/
  addToSelectedList(dynamicItem: SelectedSkuIteModel): void {
    let insertedIndex = 0;
    // بررسی امکان انتخاب گزینه تکراری
    if (this.item.settings?.canSelectDuplicateItems) {
      insertedIndex = this.appendToSelectedListWithSort(dynamicItem);
    } else {
      const finded = this.item.selectedList.findIndex((x) => x.identificationCode === dynamicItem.identificationCode);
      if (finded >= 0) {
        this.notify.info(this.translateService.instant('ThisOptionIsExistInlist'));
      } else {
        insertedIndex = this.appendToSelectedListWithSort(dynamicItem);
      }
    }

    setTimeout(() => {
      this.scrollIntoView(this.item.fid, dynamicItem.identificationCode, insertedIndex);
    }, 100);
  }

  /**
   * اضافه کردن به لیست سورت شده
   * @param dynamicItem آیتم
   */
  appendToSelectedListWithSort(dynamicItem: SelectedSkuIteModel): number {
    dynamicItem = cloneDeep(dynamicItem);
    dynamicItem.formValid = undefined;
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
    this.isChangedValue();
    return index;
  }

  deleteFromSelectedList(dynamicItem: SelectedSkuIteModel, index: number): void {
    if (this.disabled) {
      return;
    }
    this.alert
      .show({
        text: this.translateService.instant('AreYouSureDelete{value}', { value: dynamicItem.answerTitle }),
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
          this.item.selectedList.splice(index, 1);
          this.isChangedValue();
          this.logicService.updateProgressBar();
        }
      });
  }

  /*------------------------------------------------------------------------*/

  showInnerQuestions(sku: SelectedSkuIteModel): void {
    if (this.disabled) {
      return;
    }
    //set child in matrix - need in edit form
    // todo: review load in getForEdit
    for (let question of this.questionChilds) {
      if (
        !question.questionChilds &&
        [FormQuestionTypesEnum.Matrix, FormQuestionTypesEnum.Matrix_Dynamic, FormQuestionTypesEnum.Group].indexOf(
          question.questionType,
        ) > -1
      ) {
        question.questionChilds = this.vote.questionList.filter((x) => x.parentUniqueId == question.uniqueId);
      }
    }
    this.matDialog
      .open(RetailAuditChildsComponent, {
        data: <IRetailAuditDialogData>{
          parent: this.item,
          baseQuestions: this.questionChilds,
          skuQuestionChilds: sku.questionChilds,
          sku: sku,
        },
        width: '80vw',
        direction: this.languageService.direction,
        panelClass: 'custom-dialog',
      })
      .afterClosed()
      .subscribe((result: { formValid: boolean; result: QuestionModel[]; variables: { [key: string]: string } }) => {
        if (result) {
          sku.formValid = result.formValid;
          sku.questionChilds = result.result;
          sku.retaliVariables = result.variables;
          // console.log('sku', sku);
          this.isChangedValue();
          this.logicService.updateProgressBar();
        }
      });
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

  scrollIntoView(questionfId: string, id: number | string, insertedIndex: number): void {
    let rowSelector = '#sku_question_' + questionfId + ' #sku-row-' + id + '.indx-' + insertedIndex;

    const element: any = this._document.querySelector(rowSelector);
    const scrollOffset = 50;
    // console.log(element);
    if (element) {
      const elBound = element.getBoundingClientRect();
      const scrolY = window.scrollY;
      const scrolX = window.scrollX;
      const top = Math.abs(scrolY + elBound.top);
      const left = Math.abs(scrolX + elBound.left);

      window.scrollTo({
        top: top - scrollOffset,
        behavior: 'smooth',
      });
      this.createAnim('anim-highlight-row', element, 1000);
    }
    this.setFocusTextBox(id);
  }

  selectText(ev: any): void {
    ev.currentTarget?.select();
  }
  /**
   * set textbox focus
   */
  setFocusTextBox(id: number | string): void {
    const rowSelector = '#sku_question_' + this.item.fid + ' #sku-row-' + id;
    const txtElInRow: any = this._document.querySelector(rowSelector + ' #skunumber' + id);
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

  createAnim(className: string, elem: Element, delay = 100): void {
    elem.classList.add(className);
    setTimeout(() => {
      elem.classList.remove(className);
    }, delay);
  }

  isChangedValue() {
    this.item.answer = this.item.selectedList;
    this.myControl.setValue(this.item.selectedList.filter((x) => x.formValid).length);
    this._onChange(this.myControl.value);
    this.myControl.updateValueAndValidity();
    this._onValidatorChange();
  }
}

export function checkAllSkuFormIsValid(item: QuestionModel): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    let isInvalid = item.selectedList.some((x) => !x.formValid);
    if (isInvalid) {
      return { invalid: true };
    }
    return null;
  };
}
