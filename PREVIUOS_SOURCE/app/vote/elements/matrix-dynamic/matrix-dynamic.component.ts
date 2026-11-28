import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, Injector, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { QuestionModel } from '@core/models/QuestionModel';
import { VoteBaseComponent } from '../../vote-base.component';
import { MatrixColumn, MatrixRow } from './matrix-dynamic.models';
import { EventEnum } from '@core/models/enums';

@Component({
  standalone: false,
  selector: 'matrix-dynamic',
  templateUrl: './matrix-dynamic.component.html',
  styleUrls: ['./matrix-dynamic.component.scss'],
})
export class MatrixDynamicComponent extends VoteBaseComponent implements OnInit {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  columnSize: { [ColumnIndex: number]: number } = {};
  cols: MatrixColumn[] = [];
  rows: MatrixRow[] = [];

  questionChild: QuestionModel[] = [];

  isColumnView = new Observable<boolean>();
  isInValidMatrixQuestionChilds = false;
  isSimpleMode = false;
  constructor(
    injector: Injector,
    private breakpointObserver: BreakpointObserver,
  ) {
    super(injector);
  }

  ngOnInit() {
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
    if (this.item.settings && this.item.settings.matrixConfig && typeof this.item.settings.matrixConfig === 'object') {
      this.columnSize = this.item.settings.matrixConfig.columnSize;
      this.isSimpleMode = this.item.settings?.matrixConfig.simpleMode;
    }
    // this.item.isRequired = this.questionChild.filter(x => x.isActive).some(x => x.isRequired);
    this.generateColAndRow();

    app.event.on(EventEnum.UpdateVariableInTitle + this.item.uniqueId, (q: QuestionModel) => {
      const rf = this.rows.find((r) => r.uniqueId == q.uniqueId);
      if (rf) rf.title = q.title ?? '';
      const cf = this.cols.find((x) => x.uniqueId == q.uniqueId);
      if (cf) cf.description = q.description ?? '';
    });
  }

  generateColAndRow() {
    this.cols = [];
    let parts = this.item.matrixParts ?? 1;
    for (let colNum = 0; colNum < parts; colNum++) {
      this.cols.push({
        uniqueId: this.questionChild[colNum]?.uniqueId,
        questionType: this.questionChild[colNum]?.questionType,
        description: this.questionChild[colNum]?.description ?? '',
        isEdit: false,
      });
    }
    const rowCount = this.questionChild.length / parts;
    this.rows = [];
    for (let rowNum = 0; rowNum < rowCount; rowNum++) {
      this.rows.push({
        uniqueId: this.questionChild[this.cols.length * rowNum]?.uniqueId,
        title: this.questionChild[this.cols.length * rowNum]?.title ?? '',
        isEdit: false,
      });
    }
    if (this.questionChild.length == this.cols.length * this.rows.length) {
      this.isInValidMatrixQuestionChilds = false;
    } else {
      this.isInValidMatrixQuestionChilds = true;
    }
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    app.event.off(EventEnum.UpdateVariableInTitle + this.item.uniqueId);
  }

  toggleMatrixPanel(row: MatrixRow, panelBody: HTMLDivElement) {
    // اگر پنل به خاطر اسکرول به پرسش نامعتبر باز شده بود
    if (panelBody.classList.contains('is-open') && !row.isOpen) {
      panelBody.classList.remove('is-open');
    } else {
      row.isOpen = !row.isOpen;
    }
  }
}
