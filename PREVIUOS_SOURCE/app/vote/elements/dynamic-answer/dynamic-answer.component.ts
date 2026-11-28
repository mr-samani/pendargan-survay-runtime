import { AfterViewInit, Component, forwardRef, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of, finalize } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { RequireMatch } from '@core/custom-validator/requireMatch';
import { QuestionModel } from '@core/models/QuestionModel';
import { AppConsts } from '@core/app-consts';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { cloneDeep } from 'lodash-es';
import { EventEnum } from '@core/models/enums';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { GetDynamicOptionAutoCompleteOutpotDto } from '@core/models/backend-dto/QuestionJsonDataDto';
import { DynamicOptionAutoCompleteListInputDto } from '@core/models/backend-dto/DynamicOptionAutoCompleteListInputDto';
import { DynamicDataResult } from '@core/models/DynamicDataResult';

@Component({
  standalone: false,
  selector: 'dynamic-answer',
  templateUrl: './dynamic-answer.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DynamicAnswerComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DynamicAnswerComponent),
      multi: true,
    },
  ],
  styles: [
    `
      .input-group {
        min-width: 240px;
      }
    `,
    `
      .mat-progress-bar-container {
        height: 10px;
        opacity: 0.2;
      }
    `,
  ],
})
export class DynamicAnswerComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, Validator, AfterViewInit, OnDestroy
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
  loading = true;
  listCount = 0;
  filteredList = new Observable<DynamicDataResult[]>();
  dynamicDataOptions: DynamicDataResult[] = [];

  defaultAnswerStateForClear: { [key: string]: string } | undefined = {};

  /** پاسخ قبلی در هنگام ویرایش فرم */
  previousAnswer?: DynamicDataResult;
  isFirstLoad = true;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required, RequireMatch]);
      this.myControl.updateValueAndValidity();
    } else {
      this.myControl.setValidators([RequireMatch]);
      this.myControl.updateValueAndValidity();
    }
    app.event.on(EventEnum.FilterDynamicDataEvent + this.item.uniqueId, () => {
      if (!this._disabled) {
        this.myControl.reset();
        this.item.answer = '';
        this.ngAfterViewInit(true);
        this.changeDetectorRef.markForCheck();
        this.clearAnswerState();
      }
    });
  }

  public isNullOrEmpty(value: any) {
    return isNullOrEmpty(value);
  }

  ngOnDestroy(): void {
    app.event.off(EventEnum.FilterDynamicDataEvent + this.item.uniqueId);
  }

  writeValue(value: any): void {
    this.isFirstLoad = true;
    if (value) {
      if (this.item.settings?.checkDuplicateOptionInSectionLoop) {
        if (this.checkDuplicate(value) === false) {
          this.myControl.setValue(value);
        }
      } else {
        this.myControl.setValue(value);
      }
    } else {
      this.myControl.reset();
    }
    this.previousAnswer = this.myControl.value;
    this.onChangeSelection();
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
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
  private _filter(value: string | any, setValue = false): Observable<DynamicDataResult[]> {
    if (typeof value === 'object' && value !== null) {
      value = ''; // value.answerTitle;
    }
    this.loading = true;
    let dynamicExpression = this.item.fieldValueFilter ?? '';
    // let prefix = 'Q' + this.item.fid + '.Data.';
    // fieldToSearch = fieldToSearch.replace(new RegExp(prefix, 'ig'), '');
    const input: DynamicOptionAutoCompleteListInputDto = {
      dynamicDataUniqueId: this.item.dynamicDataUniqueId,
      fieldToSearchIn: dynamicExpression.trim() ? 'DynamicExpression' : '',
      fieldValueFilter: dynamicExpression,
      searchText: value ? value : '',
      resultsNumber: 500,
      formGuid: this.vote.formGuid,
      recordIdArrayToGet: undefined,
      searchWithoutSpace: true,
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
          this.dynamicDataOptions = response.result?.questionJsonDataList ?? [];
          this.listCount = response.result?.totalCount ?? 0;

          for (const item of this.dynamicDataOptions) {
            item.isSelectedInSectionLoop = false;
            if (this.item.settings?.checkDuplicateOptionInSectionLoop && this.checkDuplicate(item) === true) {
              item.isSelectedInSectionLoop = true;
            }
          }
          if (
            setValue &&
            this.previousAnswer &&
            this.dynamicDataOptions.findIndex((x) => x.identificationCode == this.previousAnswer?.identificationCode) >
              -1
          ) {
            this.myControl.setValue(this.previousAnswer);
            this.item.answer = this.previousAnswer;
          }
          if (this.isFirstLoad) {
            this.autoSelectFirstOption();
          }
          this.setAnswerStateSelectableCount();

          this.isFirstLoad = false;
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

  clearItem(trigger: MatAutocompleteTrigger, auto: MatAutocomplete): void {
    if (this._disabled) {
      return;
    }
    this.myControl.reset('');
    this.previousAnswer = undefined;
    this.clearAnswerState();
    setTimeout(() => {
      auto.options.forEach((item) => {
        item.deselect();
      });
      trigger.openPanel();
    }, 100);
  }

  clearAnswerState(): void {
    // tslint:disable-next-line: forin
    for (const property in this.defaultAnswerStateForClear) {
      const dynamicField = this.item.dynamicDataFields?.find((x) => x.nameSpace === property);
      if (dynamicField) {
        if (dynamicField.isNumeric) {
          this.vote.answerStates['Q' + this.item.fid + '.Data.' + property] = null;
        } else {
          this.vote.answerStates['Q' + this.item.fid + '.Data.' + property] = '""';
        }
      }
    }
    this.logicService.changeAnswer(this.item);
    this._onChange(this.myControl.value);
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

  onChangeSelection(): void {
    const formValue: DynamicDataResult = this.myControl.value;
    if (!formValue || !formValue?.identificationCode || this._disabled) {
      return;
    }

    if (this.item.settings?.checkDuplicateOptionInSectionLoop && this.checkDuplicate(formValue) === true) {
      this.alert.show({
        title: this.translateService.instant('WarningIsDuplicateDynamicAnswer', {
          title: formValue.answerTitle,
        }),
        showConfirmButton: true,
        showCancelButton: false,
        confirmButtonText: this.translateService.instant('Ok'),
      });
      this.myControl.reset('');
      this.clearAnswerState();
      return;
    }
    this.item.answer = formValue;
    let dynamicDataColumns = formValue.jsonValuesDictionary;
    this.defaultAnswerStateForClear = cloneDeep(dynamicDataColumns);
    // tslint:disable-next-line: forin
    for (const property in dynamicDataColumns) {
      const dynamicField = this.item.dynamicDataFields?.find((x) => x.nameSpace === property);
      if (dynamicField) {
        if (dynamicField.isNumeric) {
          this.vote.answerStates['Q' + this.item.fid + '.Data.' + property] = +dynamicDataColumns[property];
        } else {
          this.vote.answerStates['Q' + this.item.fid + '.Data.' + property] = '"' + dynamicDataColumns[property] + '"';
        }
      }
    }
    this.setAnswerStateSelectableCount();
    this.vote.answerStates['Q' + this.item.fid + '.Data.TotalAnswers'] = this.listCount;
    this.logicService.changeAnswer(this.item);
    this.myControl.setValue(this.item.answer);
    this._onChange(this.item.answer);
  }

  setAnswerStateSelectableCount() {
    if (this.item.settings?.checkDuplicateOptionInSectionLoop && this.item.answer) {
      let i = this.dynamicDataOptions.findIndex((x) => x.identificationCode === this.item.answer.identificationCode);
      if (i > -1) {
        this.dynamicDataOptions[i].isSelectedInSectionLoop = true;
      }
    }

    let selectedInSectionLoopCount = this.dynamicDataOptions.filter((x) => x.isSelectedInSectionLoop).length;
    this.vote.answerStates['Q' + this.item.fid + '.selectableItemCount'] = this.listCount - selectedInSectionLoopCount;

    this.logicService.runFormula(this.item.uniqueId);
  }

  // onKeyPress(ev: KeyboardEvent, trigger: MatAutocompleteTrigger): void {
  //   if (ev.key === 'Enter') {
  //     ev.stopPropagation();
  //     ev.preventDefault();
  //     this.control.setValue(trigger.activeOption?.value);
  //   }
  // }

  checkDuplicate(answer: DynamicDataResult) {
    let isDuplicate = false;
    const currentSection = this.vote.sections[this.vote.currentSectionPage];
    let thisRepeatedPages = this.logicService.pages.filter(
      (x) => x.formSectionUniqueId === this.item.formSectionUniqueId,
    );
    for (let p of thisRepeatedPages) {
      if (p.loopNumber < (currentSection.loopNumber ?? 0)) {
        for (let q of p.questionList) {
          if (q.uniqueId === this.item.uniqueId && q.answer?.identificationCode === answer?.identificationCode) {
            isDuplicate = true;
            break;
          }
        }
      }
    }
    return isDuplicate;
  }

  autoSelectFirstOption() {
    if (this.item.settings?.autoSelectFirstOption && !this.myControl.value) {
      let firstOpt = this.dynamicDataOptions.filter((x) => !x.isSelectedInSectionLoop);
      if (firstOpt.length > 0) {
        this.myControl.setValue(firstOpt[0] as any);
        this.onChangeSelection();
      }
    }
  }
}
