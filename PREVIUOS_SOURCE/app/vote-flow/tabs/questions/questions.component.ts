import { Component, Injector, OnInit } from '@angular/core';
import { SharedVoteFlowModule } from '@app/vote-flow/shared-vote-flow.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { AnswerModel } from '@core/models/AnswerModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { ExpressionGraphComponent, GraphInput } from '../expression-graph/expression-graph.component';
import { PageEvent } from '@angular/material/paginator';
import { AppCoreModule } from '@core/core.module';

@Component({
  selector: 'question-list',
  templateUrl: './questions.component.html',
  styleUrls: ['./questions.component.scss'],
  imports: [SharedVoteFlowModule, AppCoreModule],
})
export class VoteFlowQuestionListComponent extends VoteBaseComponent implements OnInit {
  filter = '';
  list: QuestionModel[] = [];
  totalCount = 0;
  pageSize = 50;
  pageIndex = 0;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.search();
  }

  search() {
    let list = this.vote.questionList.filter(
      (x) =>
        x.title?.toLowerCase()?.includes(this.filter?.toLowerCase()) ||
        x.description?.toLowerCase()?.includes(this.filter?.toLowerCase()) ||
        x.uniqueId == this.filter?.toLowerCase(),
    );
    this.totalCount = list.length;
    let from = this.pageIndex * this.pageSize;
    let to = this.pageIndex * this.pageSize + this.pageSize;
    this.list = list.slice(from, to);
  }

  returnZero() {
    return 0;
  }
  handlePageEvent(e: PageEvent) {
    this.pageSize = e.pageSize;
    this.pageIndex = e.pageIndex;
    this.search();
  }

  openGraph(item: QuestionModel) {
    let formulaList = this.vote.formulaList.filter((x) => x.formQuestionUniqueId == item.uniqueId);
    this.matDialog.open(ExpressionGraphComponent, {
      closeOnNavigation: true,
      disableClose: false,
      panelClass: 'custom-dialog',
      width: '98vw',
      minWidth: '98vw',
      data: <GraphInput>{
        formulaList,
        graphType: 'formula',
      },
    });
  }

  log(item: QuestionModel) {
    console.log(item);
  }

  openOptionGraph(item: QuestionModel, opt: AnswerModel) {
    let formulaList = this.vote.formulaList.filter((x) => x.targetKey == opt.uniqueIdPerForm);
    this.matDialog.open(ExpressionGraphComponent, {
      closeOnNavigation: true,
      disableClose: false,
      panelClass: 'custom-dialog',
      width: '98vw',
      minWidth: '98vw',
      data: <GraphInput>{
        formulaList,
        graphType: 'formula',
      },
    });
  }
}
