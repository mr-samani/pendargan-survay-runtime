import { Component, Injector } from '@angular/core';
import { PollTokenDto } from '../../../core/models/backend-dto/PollTokenDto';
import { GetPollTokenForWidgetInputDto } from '../../../core/models/backend-dto/GetPollTokenForWidgetInputDto';
import { GetWidgetAllActivePollsOutputDto } from '../../../core/models/backend-dto/GetWidgetAllActivePollsOutputDto';
import { appAnimation } from '@core/animations/routerTransition';
import { BaseComponent } from '@app/base.component';
import { AppConsts } from '@core/app-consts';
import { finalize } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-widget-poll-list',
  templateUrl: './widget-poll-list.component.html',
  styleUrls: ['./widget-poll-list.component.scss'],
  animations: [appAnimation()],
})
export class WidgetPollListComponent extends BaseComponent {
  appBaseLogoSm = '';
  pollList: GetWidgetAllActivePollsOutputDto[] = [];
  tenantName = '';
  constructor(injector: Injector) {
    super(injector);
    this.pollList = this.route.snapshot.data['data'] ?? [];
    this.tenantName = this.route.snapshot.params['tenant'] ?? '';
    if (this.tenantName.toLowerCase() === 'host') {
      this.tenantName = '';
    }
  }

  ngOnInit(): void {
    if (window.opener) window.opener?.postMessage('hideBackButton', '*');
    else window.postMessage('hideBackButton', '*');
  }

  open(item: GetWidgetAllActivePollsOutputDto) {
    this.mainSpinnerService.showLoading = true;
    const input = new GetPollTokenForWidgetInputDto();
    input.tenantId = item.tenantId;
    input.pollUniqueId = item.pollUniqueId;
    this.dataService
      .post<PollTokenDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.getPollTokenInWidget, input)
      .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
      .subscribe({
        next: (response) => {
          this.router.navigate(['/' + (this.tenantName ? this.tenantName + '/' : '') + response.result.token], {
            queryParams: {
              openedFromWidgetPollList: true,
            },
          });
          // وقتی کاربر وارد یک صفحه شد باید به ویجت خبر دهیم که دکمه باز گشت  را نشان دهد
          window.opener?.postMessage('urlChanged', '*');
        },
        error: (error: any) => {
          // tslint:disable-next-line: no-console
          console.timeEnd('call poll api');
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
        },
      });
  }
}
