import { Component, Injector, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SharedVoteFlowModule } from '@app/vote-flow/shared-vote-flow.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { QuestionModel } from '@core/models/QuestionModel';
import { startWith, debounceTime, distinctUntilChanged, switchMap, Observable, of } from 'rxjs';
import { ExpressionGraphComponent, GraphInput } from '../expression-graph/expression-graph.component';
import { FormGlobalVariableTypeEnum } from '@core/models/backend-dto/FormGlobalVariableTypeEnum';
import { GlobalVariableModel } from '@core/models/GlobalVariableModel';

@Component({
  selector: 'variable-list',
  templateUrl: './variables.component.html',
  styleUrls: ['./variables.component.scss'],
  imports: [SharedVoteFlowModule],
})
export class VoteFlowVariablesComponent extends VoteBaseComponent implements OnInit {
  filterControl = new FormControl<string>('');
  variableList = new Observable<GlobalVariableModel[]>();
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.variableList = this.filterControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => this._filter(value)),
    );
  }

  get FormGlobalVariableTypeEnum(): typeof FormGlobalVariableTypeEnum {
    return FormGlobalVariableTypeEnum;
  }

  private _filter(value: string | QuestionModel | null | undefined) {
    if (value == undefined || value == null) {
      value = '';
    }
    if (typeof value != 'string') {
      value = value?.title;
    }
    let filtered = this.vote.gvarList.filter((x) => x.title.toLowerCase().includes(value?.toLowerCase() ?? ''));
    return of(filtered);
  }

  openGraph(item: GlobalVariableModel) {
    this.matDialog.open(ExpressionGraphComponent, {
      closeOnNavigation: true,
      disableClose: false,
      panelClass: 'custom-dialog',
      width: '98vw',
      minWidth: '98vw',
      data: <GraphInput>{
        variableList: [item],
        graphType: 'variable',
      },
    });
  }
}
