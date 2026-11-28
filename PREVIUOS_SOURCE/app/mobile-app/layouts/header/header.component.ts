import { Component, Injector, Input } from '@angular/core';
import { MobileAppBaseComponent } from '../../mobile-app-base-component';
import { AppConsts } from '@core/app-consts';
import { finalize } from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent extends MobileAppBaseComponent {
  constructor(injector: Injector) {
    super(injector);
  }

  back() {
    this.mainSpinnerService.showLoading = true;
    this.dataService
      .post(AppConsts.hybridUrl + AppConsts.pwaUrls.pwaGoBack, {
        doNotAsk: true,
      })
      .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
      .subscribe();
  }
}
