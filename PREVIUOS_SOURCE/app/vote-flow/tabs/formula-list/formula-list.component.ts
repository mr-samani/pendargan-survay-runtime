import { Component, Injector, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SharedVoteFlowModule } from '@app/vote-flow/shared-vote-flow.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { ExpressionTargetsEnum } from '@core/models/backend-dto/ExpressionTargetsEnum';
import { ExpressionActionsEnum } from '@core/models/backend-dto/ExpressionActionsEnum';
import { FormExpressionTypeEnum } from '@core/models/backend-dto/FormExpressionTypeEnum';
import { QuestionModel } from '@core/models/QuestionModel';
import { startWith, debounceTime, distinctUntilChanged, switchMap, Observable, of } from 'rxjs';
import { ExpressionGraphComponent, GraphInput } from '../expression-graph/expression-graph.component';
import { FormulaModel } from '@core/models/FormulaModel';
import { AppCoreModule } from '@core/core.module';

@Component({
  selector: 'formula-list',
  templateUrl: './formula-list.component.html',
  styleUrls: ['./formula-list.component.scss'],
  imports: [SharedVoteFlowModule, AppCoreModule],
})
export class VoteFlowFormulaGraphComponent extends VoteBaseComponent implements OnInit {
  filter = '';
  formulaList: FormulaModel[] = [];

  /** پرسش هایی که فرمول دارند */
  questions: QuestionModel[] = [];
  questionControl = new FormControl<QuestionModel | undefined>(undefined);
  filteredQuestionList = new Observable<QuestionModel[]>();
  constructor(injector: Injector) {
    super(injector);
    let qids = this.vote.formulaList.map((x) => x.formQuestionUniqueId);
    this.questions = this.vote.questionList.filter((x) => qids.indexOf(x.uniqueId) > -1);
    this.search();
  }

  ngOnInit(): void {
    this.filteredQuestionList = this.questionControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this._filterQuestions(value)),
    );
  }

  public get ExpressionActionsEnum(): typeof ExpressionActionsEnum {
    return ExpressionActionsEnum;
  }
  public get ExpressionTargetsEnum(): typeof ExpressionTargetsEnum {
    return ExpressionTargetsEnum;
  }
  public get FormExpressionTypeEnum(): typeof FormExpressionTypeEnum {
    return FormExpressionTypeEnum;
  }

  private _filterQuestions(value: string | QuestionModel | null | undefined) {
    if (value == undefined || value == null) {
      value = '';
    }
    if (typeof value != 'string') {
      value = value?.title;
    }
    let filtered = this.questions.filter((x) => x.title?.toLowerCase()?.includes(value?.toLowerCase() ?? ''));
    return of(filtered);
  }

  search() {
    this.formulaList = this.vote.formulaList;
    if (this.questionControl.value) {
      this.formulaList = this.formulaList.filter((x) => x.formQuestionUniqueId == this.questionControl.value?.uniqueId);
    }
    this.formulaList = this.formulaList.filter((x) =>
      x.expressionText?.toLowerCase()?.includes(this.filter.toLowerCase()),
    );
  }

  displayFn(option: any): string {
    return option && option.title ? option.title : '';
  }

  openGraph(item: FormulaModel) {
    this.matDialog.open(ExpressionGraphComponent, {
      closeOnNavigation: true,
      disableClose: false,
      panelClass: 'custom-dialog',
      width: '98vw',
      minWidth: '98vw',
      data: <GraphInput>{
        formulaList: [item],
        graphType: 'formula',
      },
    });
  }
}
