import { Component, Inject, Injector, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { SharedVoteFlowModule } from './shared-vote-flow.module';
import { VoteFlowFormulaGraphComponent } from './tabs/formula-list/formula-list.component';
import { VoteFlowVariablesComponent } from './tabs/variables/variables.component';
import { VoteFlowSectionListComponent } from './tabs/sections/sections.component';
import { VoteFlowQuestionListComponent } from './tabs/questions/questions.component';
import { VoteFlowPageListComponent } from './tabs/pages/pages.component';

@Component({
  selector: 'vote-flow',
  templateUrl: './vote-flow.component.html',
  styleUrls: ['./vote-flow.component.scss'],
  imports: [
    SharedVoteFlowModule,
    VoteFlowFormulaGraphComponent,
    VoteFlowVariablesComponent,
    VoteFlowSectionListComponent,
    VoteFlowQuestionListComponent,
    VoteFlowPageListComponent,
  ],
})
export class VoteFlowDialog extends VoteBaseComponent implements OnInit {
  constructor(
    injector: Injector,
    private dialogRef: MatDialogRef<VoteFlowDialog>,
    @Inject(MAT_DIALOG_DATA) data: any,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
  }

  showLogInConsole() {
    console.clear();
    console.warn('questions', this.vote.questionList);
    console.table(this.vote.formulaList, [
      'id',
      'expressionText',
      'targetType',
      'actionType',
      'targetKey',
      'result',
      'resultUpdated',
    ]);
    console.table(this.vote.gvarList, ['id', 'title', 'expression', 'result', 'resultUpdated']);
    console.info('sections', this.vote.sections);
    console.log('answerStates', this.vote.answerStates);
    console.log('events', app.event._callbacks);
    console.log('pages', this.logicService.pages);
  }
}
