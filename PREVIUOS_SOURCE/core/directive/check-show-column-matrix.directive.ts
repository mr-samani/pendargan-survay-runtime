import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { EventEnum } from '../models/enums';
import { QuestionModel } from '@core/models/QuestionModel';
import { throttle } from 'lodash-es';

@Directive({
  standalone: false,
  selector: '[CheckShowColumnMatrix]',
})
export class CheckShowColumnMatrixDirective implements AfterViewInit, OnDestroy {
  // نمایش یا عدم نمایش ستون ها تغییر کرده است
  @Output() updatedColumns = new EventEmitter<void>();
  @Input() parentQuestion!: QuestionModel;
  table: HTMLTableElement;
  constructor(private el: ElementRef<HTMLTableElement>) {
    this.table = el.nativeElement;
  }

  ngAfterViewInit(): void {
    this.check();
    app.event.on(EventEnum.TriggerUpdateFormula + this.parentQuestion.uniqueId, () => {
      this.throttledCheck();
    });
  }

  throttledCheck = throttle(() => {
    setTimeout(() => {
      this.check();
    }, 100);
  }, 100);

  ngOnDestroy(): void {
    app.event.off(EventEnum.TriggerUpdateFormula + this.parentQuestion.uniqueId);
  }

  check(): void {
    // console.log(
    //   'column',
    //   'EventEnum.TriggerUpdateFormula + this.parentQuestion.uniqueId' +
    //     EventEnum.TriggerUpdateFormula +
    //     this.parentQuestion.uniqueId,
    // );

    // console.time('check!');
    const trs = this.table.querySelector('tbody')?.querySelectorAll('tr');
    if (!trs) return;
    let columnsHasValues: { [rowkey: number]: { [colkey: string]: number } } = {};
    trs.forEach((tr, rowIndex) => {
      let tds = tr.querySelectorAll('td');
      columnsHasValues[rowIndex] = {};
      tds.forEach((td, colIndex) => {
        columnsHasValues[rowIndex][colIndex] = Array.from(td.children).filter(
          (e) => e.classList.contains('dontShow') == false,
        ).length;
      });
    });

    let showHide: { [colIndex: number]: number } = {};
    for (let rows of Object.entries(columnsHasValues)) {
      for (let cols of Object.entries(rows[1])) {
        showHide[+cols[0]] = (showHide[+cols[0]] ?? 0) || cols[1];
      }
    }
    // console.timeEnd('check!');

    //  console.time('updated!');
    let updated = false;
    // console.table(showHide);
    for (let col of Object.entries(showHide)) {
      let columnIndex = +col[0];
      let columnValue = +col[1];
      this.table.querySelectorAll('tr:not(.is-merged-cell)').forEach((tr) => {
        let cell = tr.querySelectorAll('td:not(.is-question-title),th:not(.is-merged-cell,.is-question-title)')[
          columnIndex
        ];
        if (cell) {
          // اگر ستون قبلا مخفی شده بود دیگر updateColums صدا زده نشود
          const previousHideState = cell.classList.contains('d-none');
          if (columnValue === 0 && previousHideState == false) {
            cell.classList.add('d-none');
            updated = true;
          } else if (columnValue !== 0 && previousHideState == true) {
            cell.classList.remove('d-none');
            updated = true;
          }
        }
      });
    }
    if (updated) {
      this.updatedColumns.emit();
    }
    // console.timeEnd('updated!');
  }
}
