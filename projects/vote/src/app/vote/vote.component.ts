import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  FormQuestionTypesEnum,
  GetAllFormDetailForViewInputDto,
  type GetPollGuidByTokenOutputDto,
} from '@service-proxies/models';
import { FormVotingService } from '@service-proxies/services';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { VoteService } from '../questions/services/vote.service';
import { QuestionTitleComponent } from '../questions/_question-title/question-title.component';
import { finalize } from 'rxjs';
import { MSG } from 'ngx-kit/message';
import { QuestionRuntimeEventBus } from '../questions/shared/question-runtime-event-bus';

@Component({
  selector: 'app-vote',
  templateUrl: './vote.component.html',
  styleUrls: ['./vote.component.scss'],
  imports: [NgComponentOutlet, CommonModule, QuestionTitleComponent],
  providers: [QuestionRuntimeEventBus],
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
      .pipe(finalize(() => console.timeEnd('call poll api')))
      .subscribe({
        next: async (resp) => {
          this.vote
            .handleFormDetailsData(resp)
            .then((r) => {
              this.isLoading.set(false);
            })
            .catch((err) => {
              MSG.error(err?.message).afterClose.subscribe(() => {
                console.warn('Close Window!');
              });
            });
        },
        error: (er: any) => {
          this.isLoading.set(false);
          // this.handleApiError(er, true);
        },
      });
  }
}
