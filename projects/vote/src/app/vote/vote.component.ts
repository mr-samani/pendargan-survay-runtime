import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, ɵEmptyOutletComponent } from '@angular/router';
import {
  FormQuestionTypesEnum,
  GetAllFormDetailForViewInputDto,
  type GetAllFormDetailForViewOutputDto,
  type GetPollGuidByTokenOutputDto,
} from '@service-proxies/models';
import { FormVotingService } from '@service-proxies/services';
import { finalize } from 'rxjs'; 
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { VoteService } from '../questions/services/vote.service';

@Component({
  selector: 'app-vote',
  templateUrl: './vote.component.html',
  styleUrls: ['./vote.component.scss'],
  imports: [NgComponentOutlet, CommonModule],
})
export class VoteComponent implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly formService = inject(FormVotingService);
  protected readonly vote = inject(VoteService);

  readonly isLoading = signal(false);

  constructor() {
    const data: GetPollGuidByTokenOutputDto = this.route.snapshot.data['data'];
    this.initialize(data.guid!);
  }

  ngOnInit() {}

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }

  initialize(guid: string): void {
    this.isLoading.set(true);
    // tslint:disable-next-line: no-console
    console.time('call poll api');
    this.formService
      .getAllFormDetailForView(
        new GetAllFormDetailForViewInputDto({
          guidValue: guid,
        }),
      )
      .subscribe({
        next: async (resp) => {
          await this.vote.handleFormDetailsData(resp);
          this.isLoading.set(false);
          console.timeEnd('call poll api');
        },
        error: (er: any) => {
          // tslint:disable-next-line: no-console
          console.timeEnd('call poll api');
          this.isLoading.set(false);
          // this.handleApiError(er, true);
        },
      });
  }
}
