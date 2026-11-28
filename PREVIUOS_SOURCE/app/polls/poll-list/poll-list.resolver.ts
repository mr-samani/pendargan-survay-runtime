import { Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { catchError, finalize, map, Observable, of } from 'rxjs';
import { AppConsts } from '@core/app-consts';
import { BaseComponent } from '@app/base.component';
import { GetTenantPublicPollOutputDto } from '@core/models/backend-dto/GetTenantPublicPollOutputDto';

@Injectable()
export class PollListResolver extends BaseComponent implements Resolve<GetTenantPublicPollOutputDto[] | null> {
  constructor(injector: Injector) {
    super(injector);
  }

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<GetTenantPublicPollOutputDto[] | null> {
    this.languageService.setPageLanguageAndDirection('fa');
    let tenantName = route.params['tenancyName'] ?? '';
    if (tenantName.toLowerCase() === 'host') {
      tenantName = '';
    }
    this.mainSpinnerService.showLoading = true;
    return this.dataService
      .get(AppConsts.apiBaseUrl + AppConsts.serverApis.tenantPublicPolls, { tenancyName: tenantName })
      .pipe(
        finalize(() => {
          this.mainSpinnerService.showLoading = false;
        }),
        map((response) => {
          return response.result ?? [];
        }),
        catchError((error) => {
          /// return of([]);
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
      );
  }
}
