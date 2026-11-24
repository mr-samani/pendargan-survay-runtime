import { Component, Inject, Injector, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SharedVoteFlowModule } from '@app/vote-flow/shared-vote-flow.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { ExpressionTargetsEnum } from '@core/models/backend-dto/ExpressionTargetsEnum';
import { ExpressionActionsEnum } from '@core/models/backend-dto/ExpressionActionsEnum';
import { FormExpressionTypeEnum } from '@core/models/backend-dto/FormExpressionTypeEnum';
import { AppCoreModule } from '../../../../core/core.module';
import { FormulaModel } from '@core/models/FormulaModel';
import { GlobalVariableModel } from '@core/models/GlobalVariableModel';

export class NodeGraph {
  title?: string;
  target?: string;
  expression!: string;
  variables!: { name: string; title: string }[];
  actionType?: ExpressionActionsEnum;
  targetType?: ExpressionTargetsEnum;
  result!: boolean | string | number;

  reachMaxCount?: boolean;
}

export class GraphInput {
  formulaList!: FormulaModel[];
  variableList!: GlobalVariableModel[];
  graphType!: 'variable' | 'formula';
}
@Component({
  selector: 'expression-graph',
  templateUrl: './expression-graph.component.html',
  styleUrls: ['./expression-graph.component.scss'],
  imports: [SharedVoteFlowModule, AppCoreModule],
})
export class ExpressionGraphComponent extends VoteBaseComponent implements OnInit {
  formulaList: FormulaModel[] = [];
  variableList: GlobalVariableModel[] = [];
  graphType: 'variable' | 'formula';
  nodes: NodeGraph[] = [];

  constructor(injector: Injector, @Inject(MAT_DIALOG_DATA) data: GraphInput) {
    super(injector);
    this.formulaList = data.formulaList;
    this.variableList = data.variableList;
    this.graphType = data.graphType;

    if (this.graphType == 'formula') {
      for (let item of this.formulaList) {
        this.nodes.push({
          target: this.getTarget(item),
          expression: item.expressionText ?? '',
          variables: this.getVariables(item.variables),
          actionType: item.actionType,
          targetType: item.targetType,
          result: item.result,
          reachMaxCount: item.reachMaxCount,
        });
      }
    } else {
      for (let item of this.variableList) {
        this.nodes.push({
          title: item.title,
          expression: item.expression,
          variables: this.getVariables(item.variables),
          result: item.result,
        });
      }
    }
  }

  ngOnInit(): void {
    
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
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

  getTarget(formula: FormulaModel) {
    switch (formula.targetType) {
      case ExpressionTargetsEnum.Question:
      case ExpressionTargetsEnum.FilterDynamicAnswer:
        const qq = this.vote.questionList.find((x) => x.uniqueIdPerForm == formula.targetKey);
        return qq?.title + '(' + qq?.description + ')';
      case ExpressionTargetsEnum.Answer:
        const q = this.vote.questionList.find((x) => x.uniqueId == formula.formQuestionUniqueId);
        return q?.questionOptions.find((x) => x.uniqueIdPerForm == formula.targetKey)?.title;
      case ExpressionTargetsEnum.Section:
      case ExpressionTargetsEnum.SectionLoop:
        let s = this.vote.sections.find((x) => x.uniqueIdPerForm == formula.targetKey);
        // let q = this.vote.questionList.find(x => x.uniqueIdPerForm == formula.formQuestionId);
        return s?.title + '(' + s?.uniqueIdPerForm + ')';
      default:
        return '';
    }
  }

  getVariables(variables?: string[]) {
    let v: any[] = [];
    if (!variables) return [];
    for (let vitem of variables) {
      v.push({
        name: vitem,
        title: this.getVariableTitle(vitem),
      });
    }
    return v;
  }

  getVariableTitle(variable: string) {
    let list = variable.split(/\.| /g).filter((x) => x.trim());
    let result = '';
    let question;
    for (let item of list) {
      if (item.toUpperCase().startsWith('Q')) {
        let qfid = item.substring(1);
        question = this.vote.questionList.find((x) => x.fid == qfid);
        if (question?.parentUniqueId) {
          result += question?.title + '(' + question?.description + ')';
        } else {
          result += question?.title;
        }
      }
      if (item.toUpperCase().startsWith('A') && question) {
        let afid = item.substring(1);
        result += '(' + question.questionOptions.find((x) => x.fid == afid)?.title + ')';
      }
    }

    return result;
  }
}
