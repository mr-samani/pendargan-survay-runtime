import { Component, Injector } from '@angular/core';
import {
  GetTenantPublicPollItemOutputDto,
  GetTenantPublicPollOutputDto,
} from '../../../core/models/backend-dto/GetTenantPublicPollOutputDto';
import { appAnimation } from '@core/animations/routerTransition';
import { BaseComponent } from '@app/base.component';

@Component({
  standalone: false,
  selector: 'app-poll-list',
  templateUrl: './poll-list.component.html',
  styleUrls: ['./poll-list.component.scss'],
  animations: [appAnimation()],
})
export class PollListComponent extends BaseComponent {
  appBaseLogoSm = '';
  pollList: GetTenantPublicPollItemOutputDto[] = [];
  tenantName = '';
  tenantLogoId = '';
  tenantTitle = '';
  constructor(injector: Injector) {
    super(injector);
    let data: GetTenantPublicPollOutputDto = this.route.snapshot.data['data'] ?? {};
    this.pollList = data.polls ?? [];
    this.tenantLogoId = data.tenantLogoId ?? '';
    this.tenantTitle = data.tenantTitle ?? '';

    this.tenantName = this.route.snapshot.params['tenancyName'] ?? '';
    if (this.tenantName.toLowerCase() === 'host') {
      this.tenantName = '';
    }
  }

  ngOnInit(): void {
    if (window.opener) window.opener?.postMessage('hideBackButton', '*');
    else window.postMessage('hideBackButton', '*');
  }
}
