import { Injectable, Injector } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MainSpinnerService } from '@app/main-spinner.service';
import { AppConsts } from '../app-consts';
import { DataService } from './data-service.service';
import { ActivatedRoute, Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class PublicService {
  /**
   * هنگام بستن پنجره به کاربر پیام تائید نشان داده شود یا خیر
   * - مثلا وقتی در صفحه شرکت در نظرسنجی بود با رفرش کردن یا بستن صفحه پیام داده شود
   */
  canClose = true;
  constructor(
    private mainSpinnerService: MainSpinnerService,
    private dataService: DataService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  closeWindow(redirectUrl = '', refreshPoll = false): void {
    this.canClose = true;
    const openedFromWidgetPollList = this.route.snapshot.queryParams['openedFromWidgetPollList'] === 'true';
    const isOpenedFromWidget = this.route.snapshot.queryParams['isOpenedFromWidget'] === 'true';
    // Web
    if (!AppConsts.isMobile) {
      // در صورتی که از نسخه یک ویجت باز شده بود(ویجت لیست نظرسنجی ها)
      if (openedFromWidgetPollList && AppConsts.tenancyName) {
        this.router.navigate(['/polls/' + AppConsts.tenancyName]);
        if (window.opener) window.opener?.postMessage('hideBackButton', '*');
        else window.postMessage('hideBackButton', '*');
        return;
      }
      // در صورتی که از سمت ویجت باز شده بود بعد از بستن دوباره نظرسنجی لود شود
      if (isOpenedFromWidget) {
        window.location.reload();
        return;
      }
      if (window.opener) {
        window.opener.postMessage('closed', '*');
      }
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        if (window.opener) {
          window.close();
        } else {
          window.location.href = AppConsts.baseUiUrl;
        }
      }
    } else {
      // Xamarin
      this.mainSpinnerService.showLoading = true;
      this.dataService
        .post(AppConsts.hybridUrl + AppConsts.pwaUrls.pwaGoBack, {
          doNotAsk: true,
          refreshPoll,
        })
        .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
        .subscribe();
    }
  }
}
