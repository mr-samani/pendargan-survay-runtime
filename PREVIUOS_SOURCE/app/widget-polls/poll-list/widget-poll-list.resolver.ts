import { Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { catchError, finalize, map, Observable, of } from 'rxjs';
import { AppConsts } from '@core/app-consts';
import { GetWidgetAllActivePollsOutputDto } from '../../../core/models/backend-dto/GetWidgetAllActivePollsOutputDto';
import { BaseComponent } from '@app/base.component';

@Injectable()
export class WidgetPollListResolver
  extends BaseComponent
  implements Resolve<GetWidgetAllActivePollsOutputDto[] | null>
{
  constructor(injector: Injector) {
    super(injector);
  }

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<GetWidgetAllActivePollsOutputDto[] | null> {
    this.languageService.setPageLanguageAndDirection('fa');

    let tenantName = route.params['tenant'] ?? '';
    if (tenantName.toLowerCase() === 'host') {
      tenantName = '';
    }
    this.mainSpinnerService.showLoading = true;

    return this.dataService.get(AppConsts.apiBaseUrl + AppConsts.serverApis.widgetPollList, { tenantName }).pipe(
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
