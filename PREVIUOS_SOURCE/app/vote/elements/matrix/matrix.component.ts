import { AfterContentInit, AfterViewInit, HostListener } from '@angular/core';
import { Component, ElementRef, forwardRef, Injector, Input, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  ValidatorFn,
} from '@angular/forms';
import { EventEnum } from '@core/models/enums';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { AnswerModel } from '@core/models/AnswerModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { Observable } from 'rxjs/internal/Observable';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map, shareReplay } from 'rxjs';
import { throttle } from 'lodash-es';
import { TableStickyResponsiveComponent } from '@app/shared/table-sticky-resposive/table-sticky-resposive.component';

export enum QuestionDirectionEnum {
  Rigth = 3,
  Center = 2,
  Left = 1,
}
@Component({
  standalone: false,
  selector: 'matrix',
  templateUrl: './matrix.component.html',
  styleUrls: ['./matrix.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MatrixComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => MatrixComponent),
      multi: true,
    },
  ],
})
export class MatrixComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, Validator, AfterViewInit
{
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  @ViewChild('matrix') matrix!: ElementRef;
  @ViewChild('stickyTable', { static: false }) stickyTable?: TableStickyResponsiveComponent;
  questionChild: QuestionModel[] = [];

  isColumnView = new Observable<boolean>();
  columnSize: { [ColumnIndex: number]: number } = {};

  constructor(
    private breakpointObserver: BreakpointObserver,
    injector: Injector,
  ) {
    super(injector);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    setTimeout(() => {
      this.ngAfterViewInit();
    }, 100);
  }

  ngOnInit(): void {
    if (this.item.settings?.matrixConfig?.responsiveInMobile) {
      this.isColumnView = this.breakpointObserver.observe('(max-width:500px)').pipe(
        map((result) => {
          return result.matches;
        }),
        shareReplay(),
      );
    }
    this.questionChild = this.vote.questionList.filter((q) => q.parentUniqueId === this.item.uniqueId);
    this.item.questionChilds = this.questionChild;
    this.checkMatrixDimensionColumnSize();

    if (this.item.matrixParts === 2) {
      for (let i = 0; i < this.questionChild.length; i = i + 2) {
        if (this.questionChild[i + 1]) {
          this.questionChild[i + 1].isActive = this.questionChild[i].isActive;
          this.questionChild[i + 1].isRequired = this.questionChild[i].isRequired;
        }
      }
    } else {
      if (!this.item.questionDirection || this.item.questionDirection == QuestionDirectionEnum.Center) {
        this.item.questionDirection = QuestionDirectionEnum.Rigth;
      }
    }
    this.sortMatrixByTemporaryAnswers();
    this.checkAllQuestionValidation();
    this.myControl.setValidators([matrixValidation(this.questionChild)]);
    this.myControl.updateValueAndValidity();
  }

  public get QuestionDirectionEnum(): typeof QuestionDirectionEnum {
    return QuestionDirectionEnum;
  }
  ngAfterViewInit(): void {
    app.event.on(EventEnum.TriggerUpdateFormula + this.item.uniqueId, () => {
      this.throttledCheck();
    });
  }

  throttledCheck = throttle(() => {
    setTimeout(() => {
      if (this.stickyTable) {
        this.stickyTable.update();
      }
    }, 100);
  }, 50);

  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  async selectionChange(question: QuestionModel): Promise<void> {
    if (this.disabled) {
      return;
    }
    setTimeout(async () => {
      let val = [];
      for (let i = 0; i < question.questionOptions.length; i++) {
        if (question.questionOptions[i].selected) {
          val.push(question.questionOptions[i].uniqueId);
        }
      }
      this.myControl.setValue(val.join(','));
      question.answer = val.join(',');

      this.checkQuestionValidation(question);
      await this.logicService.changeAnswer(question);
      this.myControl.updateValueAndValidity();
      this._onValidatorChange();
    }, 10);
  }
  async radioSelectionChange(question: QuestionModel, option: AnswerModel): Promise<void> {
    if (this.disabled) {
      return;
    }
    setTimeout(async () => {
      question.answer = option.uniqueId;
      this.checkQuestionValidation(question);
      await this.logicService.changeAnswer(question);
      this.myControl.updateValueAndValidity();
      this._onValidatorChange();
    }, 10);
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  /**
   * بررسی ولیدیشن همه پرسش های ماتریس
   */
  checkAllQuestionValidation() {
    for (let x of this.questionChild) {
      if (x.isActive && !x.dontShow) {
        this.checkQuestionValidation(x);
      }
    }
  }

  /**
   * بررسی معتبر بودن پاسخ هر پرسش
   * @param question
   */
  checkQuestionValidation(question: QuestionModel) {
    if (question.questionType === FormQuestionTypesEnum.Matrix_checkbox) {
      let answer = question.answer?.split(/،|,/)?.filter((x2: string) => x2) || [];
      if (question.isRequired && answer.length === 0) {
        question.invalid = true;
      } else if (question.minimumAnswer && answer?.length < question.minimumAnswer) {
        question.invalid = true;
      } else if (question.maximumAnswer && answer?.length > question.maximumAnswer) {
        question.invalid = true;
      } else {
        question.invalid = false;
      }
    } else {
      if (question.isRequired && !question.answer) {
        question.invalid = true;
      } else {
        question.invalid = false;
      }
    }
  }

  /**
   * اگر نمایش پرسش های ماتریس به صورت تصادفی بود
   * و فرم ذخیره موقت شده بود
   * باید پرسش هایی که از قبل پاسخ داده شده اند ابتدا نشان داده شود و مابقی پرسش ها
   * -نکته: اگر ماتریس دو بعدی بود، یک سطر یعنی دو پرسش جابجا شود
   */
  sortMatrixByTemporaryAnswers() {
    if (!this.item.isRandomizeMatrixQuestions) {
      return;
    }
    if (!this.item.matrixParts) {
      this.item.matrixParts = 0;
    }
    let swap = 0;
    for (let i = 0; i < this.questionChild.length; ) {
      if (this.questionChild[i].temporaryAnswerApplied) {
        for (let p = 0; p < this.item.matrixParts; p++) {
          this.questionChild.splice(swap + p, 0, this.questionChild[i + p]);
          this.questionChild.splice(i + p + 1, 1);
        }
        i = i + this.item.matrixParts;
        swap = swap + this.item.matrixParts;
      } else {
        i++;
      }
    }
  }

  toggleMatrixPanel(row: QuestionModel, panelBody: HTMLDivElement) {
    // اگر پنل به خاطر اسکرول به پرسش نامعتبر باز شده بود
    if (panelBody.classList.contains('is-open') && !row.isOpen) {
      panelBody.classList.remove('is-open');
    } else {
      row.isOpen = !row.isOpen;
    }
  }

  /*--------------------------------------بررسی سایز ستون ها ----------------------------------------------------*/
  checkMatrixDimensionColumnSize() {
    if (this.item.settings?.matrixConfig && typeof this.item.settings.matrixConfig === 'object') {
      this.columnSize = { ...this.item.settings.matrixConfig.columnSize };

      const isOneDimensional = this.item.matrixParts === 1;
      const isTwoDimensional = this.item.matrixParts === 2;
      const isLeftDirection = this.item.questionDirection === QuestionDirectionEnum.Left;
      const isCenterDirection = this.item.questionDirection === QuestionDirectionEnum.Center;

      // یک بعدی
      if (isOneDimensional) {
        if (isLeftDirection) {
          this.adjustColumnSizeForLeftDirection();
        }
      }
      // دو بعدی
      else if (isTwoDimensional) {
        const firstSideLength = this.questionChild[0].questionOptions.length;

        if (isCenterDirection) {
          this.adjustColumnSizeForCenterDirection(firstSideLength);
        } else if (isLeftDirection) {
          this.adjustColumnSizeForLeftDirectionWithTwoDimensions();
        }
      }
    }
  }
  // Helper methods
  private adjustColumnSizeForLeftDirection() {
    const titleSize = this.columnSize[0];
    let size = { [this.questionChild[0].questionOptions.length]: titleSize };

    Object.entries(this.columnSize).forEach(([index, colSize]) => {
      if (+index !== 0) {
        size[+index - 1] = colSize;
      }
    });

    this.columnSize = size;
  }

  private adjustColumnSizeForCenterDirection(firstSideLength: number) {
    const titleSize = this.columnSize[0];
    let size = { [firstSideLength]: titleSize };

    Object.entries(this.columnSize).forEach(([index, colSize]) => {
      const colIndex = +index;
      if (colIndex !== 0) {
        size[colIndex < firstSideLength ? colIndex - 1 : colIndex] = colSize;
      }
    });

    this.columnSize = size;
  }

  private adjustColumnSizeForLeftDirectionWithTwoDimensions() {
    const titleSize = this.columnSize[0];
    let size = {
      [this.questionChild[0].questionOptions.length + this.questionChild[1].questionOptions.length]: titleSize,
    };

    Object.entries(this.columnSize).forEach(([index, colSize]) => {
      if (+index !== 0) {
        size[+index - 1] = colSize;
      }
    });

    this.columnSize = size;
  }
  /*--------------------------------------بررسی سایز ستون ها End ----------------------------------------------------*/
}

export function matrixValidation(childs: QuestionModel[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    let invalid = childs.some((x) => !x.answer && x.dontShow === false && x.isActive === true && x.isRequired);
    if (invalid) {
      return { invalid: true };
    } else {
      return null;
    }
  };
}
