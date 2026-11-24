import { Component, inject, input, OnInit, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { AppConsts } from '@core/app-consts';
import {
  GetLatestFilledFormsInputDto,
  type PagedResultDtoOfPreviousFilledFormDto,
  type PreviousFilledFormDto,
} from '@core/models/backend-dto/LastFilledForms';
import { IResponse } from '@core/models/response';
import { DataService } from '@core/services/data-service.service';
import { map } from 'rxjs';
import { VoterDetailsDialog } from './voter-details/voter-details.component';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';

@Component({
  selector: 'vote-filled-forms',
  templateUrl: './filled-forms.component.html',
  styleUrls: ['./filled-forms.component.scss'],
  standalone: false,
})
export class FilledFormsComponent implements OnInit {
  readonly formGuid = input.required<string>();
  protected readonly dataService = inject(DataService);
  protected readonly matDialog = inject(MatDialog);

  filledForms = rxResource<PreviousFilledFormDto[], GetLatestFilledFormsInputDto>({
    params: () =>
      new GetLatestFilledFormsInputDto({
        formGuid: this.formGuid(),
      }),
    stream: (p) =>
      this.dataService
        .post<PagedResultDtoOfPreviousFilledFormDto>(
          AppConsts.apiBaseUrl + AppConsts.serverApis.getLatestFilledForms,
          p.params,
        )
        .pipe(
          map((m) => {
            let list = m.result.items ?? [];
            // only for test
            // list = Array.from({ length: 200 }).map((x) => (x = list[0]));
            return list;
          }),
        ),
  });

  readonly openPanel = signal<boolean>(false);
  constructor() {}

  ngOnInit() {}

  openVoteDetails(item: PreviousFilledFormDto) {
    const data = new GetVoterFullDetail();
    data.formSections = item.formSections ?? [];
    this.matDialog.open(VoterDetailsDialog, {
      data,
    });
  }
}
