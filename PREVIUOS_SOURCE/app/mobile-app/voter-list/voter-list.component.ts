import { ChangeDetectorRef, Component, Injector, OnInit } from '@angular/core';
import { appAnimation } from '@core/animations/routerTransition';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { GetVotersInputDto, VoterData } from './voter-list.model';
import { MatTabGroup } from '@angular/material/tabs';
import { AppConsts } from '@core/app-consts';
import { catchError, finalize, of } from 'rxjs';
import { EventEnum } from '@core/models/enums';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { VoterStatusEnum } from '@core/models/backend-dto/voter-details/VoterStatusEnum';
import { Title } from '@angular/platform-browser';
@Component({
  standalone: false,
  templateUrl: './voter-list.component.html',
  styleUrls: ['./voter-list.component.scss'],
  animations: [appAnimation()],
})
export class VoterListComponent extends MobileAppBaseComponent implements OnInit {
  finalVoterList: VoterData[] = [];
  tempVoterList: VoterData[] = [];
  tabIndex = 0;
  hideTab = false;

  trackingCode: string;
  pollUniqueId: string;
  pollId: number;
  loading = true;
  constructor(
    injector: Injector,
    private ch: ChangeDetectorRef,
    browserTitle: Title,
  ) {
    super(injector);
    const title = this.route.snapshot.queryParams['title'];
    this.headerService.headerTitle = title ?? this.translateService.instant('VoterList');
    this.hideTab = this.route.snapshot.queryParams['hideTab'] == 'true';

    this.trackingCode = this.route.snapshot.queryParams['trackingCode'];
    this.pollUniqueId = this.route.snapshot.queryParams['pollUniqueId'];
    this.pollId = this.route.snapshot.queryParams['pollId'];

    browserTitle.setTitle(this.headerService.headerTitle + ' - ' + (title ?? ''));
  }

  ngOnInit(): void {
    this.getList();
    app.event.on(EventEnum.PwaReloadListEvent, () => {
      this.getList();
    });
  }

  openDetails(item: VoterData) {
    // if form sent to server, we need to fetch data from server
    if (item.isOnline === false && item.isSent === true) {
      this.alert
        .show({
          text: this.translateService.instant('NotPossibleViewSubmittedForms_Internet'),
          cancelButtonText: this.translateService.instant('Cancel'),
          confirmButtonText: this.translateService.instant('TryAgain'),
        })
        .then((r) => {
          if (r.isConfirmed) {
            this.getList();
          }
        });
    }
    // in previews version of app isOnline not exist
    else if (isNullOrEmpty(item.isOnline) && item.isSent == true) {
      this.alert.show({
        text: this.translateService.instant('NotPossibleViewSubmittedForms'),
        confirmButtonText: this.translateService.instant('Ok'),
      });
    } else {
      this.router.navigate(['/app/voter-details'], {
        queryParams: {
          voterId: item.id,
          voterUniqueId: item.voterUniqueId,
          trackingCode: item.trackingCode,
          serverId: item.serverId,
          pollUniqueId: this.pollUniqueId,
          pollId: this.pollId,
          voterGuid: item.guid,
          // streamId: item.streamId
        },
      });
    }
  }

  onChangeTab(ev: number, tabs: MatTabGroup) {
    this.tabIndex = ev;
    tabs.realignInkBar();
  }

  getList() {
    this.loading = true;
    this.mainSpinnerService.showLoading = true;
    const input = new GetVotersInputDto();
    input.pollUniqueId = this.pollUniqueId;
    input.pollId = this.pollId;
    input.trackingCode = this.trackingCode;
    this.dataService
      .post<VoterData[]>(AppConsts.hybridUrl + AppConsts.pwaUrls.voterList, input)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.mainSpinnerService.showLoading = false;
        }),
        catchError((error) => {
          // return of([]);
          if (error.status === 404) {
            this.translateService.get('NotFoundAnyItems').subscribe((notfound) => {
              this.alert
                .show({
                  title: '404',
                  text: notfound,
                  confirmButtonText: this.translateService.instant('Ok'),
                })
                .then((result) => {
                  this.publicService.closeWindow();
                });
            });
          } else {
            this.handleApiError(error, true);
          }
          return of(null); //of(new GetVoterFullDetail());
        }),
      )
      .subscribe((response: any) => {
        let voterList: VoterData[] = response && response.result ? response.result : [];
        this.finalVoterList = voterList.filter((x) => x.status != VoterStatusEnum.TempVoter);
        this.tempVoterList = voterList.filter((x) => x.status == VoterStatusEnum.TempVoter);
        this.ch.detectChanges();
      });
  }
}
