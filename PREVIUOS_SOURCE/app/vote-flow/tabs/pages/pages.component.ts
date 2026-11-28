import { Component, Injector, OnInit } from '@angular/core';
import { SharedVoteFlowModule } from '@app/vote-flow/shared-vote-flow.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { SectionSaveModel } from '@core/models/SectionSaveModel';

@Component({
  selector: 'page-list',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.scss'],
  imports: [SharedVoteFlowModule],
})
export class VoteFlowPageListComponent extends VoteBaseComponent implements OnInit {
  list: SectionSaveModel[] = [];

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.search();
  }

  search() {
    this.list = this.logicService.pages;
  }

  returnZero() {
    return 0;
  }
}
