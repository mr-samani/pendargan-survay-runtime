import { Component, inject, OnInit, signal, Injector, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { appAnimation } from '@core/animations/routerTransition';
import { MatButtonModule } from '@angular/material/button';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { CreateVoterWithDetailsDto } from '@core/models/backend-dto/CreateVoterWithDetailsDto';
import { AppConsts } from '@core/app-consts';
import { CreateOrEditVoterAndDetailsOutputDto } from '@core/models/backend-dto/CreateOrEditVoterAndDetailsOutputDto';
import { DataService } from '@core/services/data-service.service';
import { cloneDeep, result } from 'lodash-es';
import { finalize } from 'rxjs';
import { PollRoute } from '@app/vote/helpers/poll-route';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { parse } from 'mathjs';
import type { GetPollGuidByTokenOutputDto } from '@core/models/backend-dto/GetPollGuidByTokenOutputDto';
import { GetPollGuidByVoterIdInputDto } from '@core/models/backend-dto/GetPollGuidByVoterIdInputDto';
import { CommonModule } from '@angular/common';

enum SendStatusEnum {
  Pending,
  Sending,
  Faild,
  Success,
}
class ParsedDataDto {
  isLoading?: WritableSignal<boolean>;
  status?: SendStatusEnum;
  message?: string;

  /** current guid before send */
  currentGuid?: string;
  pollUniqueId!: string;
  voterSequentialUniqueId!: string;

  data!: CreateVoterWithDetailsDto;
}

@Component({
  selector: 'app-re-form',
  templateUrl: './re-form.component.html',
  styleUrls: ['./re-form.component.scss'],
  animations: [appAnimation()],
  imports: [FormsModule, MatButtonModule, CommonModule],
})
export class ReFormComponent extends MobileAppBaseComponent {
  public sampleData = [
    {
      pollUniqueId: '30b04f24-4d59-8517-a005-01a06082a301',
      voterSequentialUniqueId: '8bd52f8c-9a29-8b3f-a4b8-01a060f683ec',
      data: { guid: 'bafac03a-832f-41eb-c61b-08df08b08adb', voterDetail: {} },
    },
  ];
  public jsonString = ``;
  public compileError = signal('');

  public parsedData: ParsedDataDto[] = [];

  constructor(injector: Injector) {
    super(injector);
    this.headerService.headerTitle = 'Edit Bulk Form';
  }

  public get SendStatusEnum(): typeof SendStatusEnum {
    return SendStatusEnum;
  }

  public compile() {
    try {
      this.compileError.set('');
      this.parsedData = [];
      if (isNullOrEmpty(this.jsonString)) {
        throw new Error('Json string is empty!');
      }

      const parsed: ParsedDataDto[] = JSON.parse(this.jsonString);
      if (!Array.isArray(parsed)) {
        throw new Error('Json string must be array!');
      }
      for (let i = 0; i < parsed.length; i++) {
        if (isNullOrEmpty(parsed[i].pollUniqueId)) {
          throw new Error('"pollUniqueId" not exist on record:' + (i + 1));
        }
        if (isNullOrEmpty(parsed[i].voterSequentialUniqueId)) {
          throw new Error('"voterSequentialUniqueId" not exist on record:' + (i + 1));
        }
        parsed[i].currentGuid = parsed[i].data.guid;
      }
      this.parsedData = parsed;
    } catch (error: any) {
      this.compileError.set(error.message);
    }
  }

  public async sendData(item: ParsedDataDto) {
    try {
      item.isLoading = signal(true);
      item.status = SendStatusEnum.Sending;
      item.message = '';

      this.getGuid(item)
        .then(async (guid: string) => {
          item.data.guid = guid;
          item.data.voterDetail.guid = guid;
          item.data.voterDetail.pollRoute = await PollRoute.get(guid);

          this.dataService
            .post<CreateOrEditVoterAndDetailsOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.savePoll, item.data)
            .pipe(finalize(() => item.isLoading?.set(false)))
            .subscribe({
              next: (response) => {
                item.status = SendStatusEnum.Success;
              },
              error: (error) => {
                item.status = SendStatusEnum.Faild;
                item.message = error?.error?.message;
              },
            });
        })
        .catch((err) => {
          item.status = SendStatusEnum.Faild;
          item.message = err;
          item.isLoading?.set(false);
        });
    } catch (error: any) {
      this.compileError.set(error.message);
    }
  }

  private getGuid(item: ParsedDataDto) {
    return new Promise<string>((resolve, reject) => {
      const input = new GetPollGuidByVoterIdInputDto({
        voterSequentialUniqueId: item.voterSequentialUniqueId,
        pollUniqueId: item.pollUniqueId,
      });
      this.dataService
        .post<GetPollGuidByTokenOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.GetPollGuidByVoterId, input)
        .subscribe({
          next: (resp: { result: GetPollGuidByTokenOutputDto }) => {
            if (isNullOrEmpty(resp?.result?.guid)) {
              throw new Error('GUID not returned from "GetPollGuidByVoterId"');
            } else {
              resolve(resp.result.guid!);
            }
          },
          error: (error) => {
            reject(error?.error?.message ?? 'Error on api "GetPollGuidByVoterId"');
          },
        });
    });
  }

  public sendAll() {
    for (let item of this.parsedData) {
      this.sendData(item);
    }
  }
}
