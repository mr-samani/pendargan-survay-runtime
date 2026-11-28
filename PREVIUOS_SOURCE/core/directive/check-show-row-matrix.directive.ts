import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';
import { MatrixColumn } from '@app/vote/elements/matrix-dynamic/matrix-dynamic.models';
import { EventEnum } from '../models/enums';
import { QuestionModel } from '@core/models/QuestionModel';
import { TableStickyResponsiveComponent } from '@app/shared/table-sticky-resposive/table-sticky-resposive.component';
import { throttle } from 'lodash-es';

@Directive({
  standalone: false,
  selector: '[CheckShowRowMatrix]',
})
export class CheckShowRowMatrixDirective implements AfterViewInit, OnDestroy {
  @Input() questionChild: QuestionModel[] = [];

  @Input() rowIndex!: number;
  @Input() matrixCols!: MatrixColumn[];
  @Input() parentQuestion!: QuestionModel;
  @Input() stickyTable?: TableStickyResponsiveComponent;
  constructor(private el: ElementRef<HTMLTableRowElement>) {}

  ngAfterViewInit(): void {
    this.check();
    app.event.on(EventEnum.TriggerUpdateFormula + this.parentQuestion.uniqueId, () => {
      //  console.info('recive trigger', EventEnum.TriggerUpdateFormula + this.parentQuestion.uniqueId);
      this.throttledCheck();
    });
  }

  throttledCheck = throttle(() => {
    setTimeout(() => {
      this.check();
    }, 100);
  }, 50);

  ngOnDestroy(): void {
    app.event.off(EventEnum.TriggerUpdateFormula + this.parentQuestion.uniqueId);
  }

  check(): void {
    let hasVisibleQuestion = false;
    for (let colIndex = 0; colIndex < this.matrixCols.length; colIndex++) {
      if (!this.questionChild[this.matrixCols.length * this.rowIndex + colIndex].dontShow) {
        hasVisibleQuestion = true;
        break;
      }
    }
    if (hasVisibleQuestion === false) {
      this.el.nativeElement.style.display = 'none';
    } else {
      this.el.nativeElement.style.display = '';
    }
    this.stickyTable?.update();
  }
}
