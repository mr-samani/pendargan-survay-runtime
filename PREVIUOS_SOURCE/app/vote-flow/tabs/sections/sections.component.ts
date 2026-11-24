import { Component, Injector, OnInit } from '@angular/core';
import { SharedVoteFlowModule } from '@app/vote-flow/shared-vote-flow.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { SectionModel } from '@core/models/SectionModel';
import { ExpressionGraphComponent, GraphInput } from '../expression-graph/expression-graph.component';

@Component({
  selector: 'section-list',
  templateUrl: './sections.component.html',
  styleUrls: ['./sections.component.scss'],
  imports: [SharedVoteFlowModule],
})
export class VoteFlowSectionListComponent extends VoteBaseComponent implements OnInit {
  filter = '';
  list: SectionModel[] | any[] = [];

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.search();
  }

  search() {
    this.list = this.vote.sections.filter(
      (x) =>
        (x.title ? x.title?.toLowerCase()?.includes(this.filter?.toLowerCase()) : true) || x.uniqueId == this.filter,
    );
  }

  returnZero() {
    return 0;
  }

  openGraph(item: SectionModel) {
    let formulaList = this.vote.formulaList.filter((x) => x.targetKey == item.uniqueIdPerForm);
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
