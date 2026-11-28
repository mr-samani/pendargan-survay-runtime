import { Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { catchError, finalize, map, Observable, of, throwError } from 'rxjs';
import { AppConsts } from '@core/app-consts';
import { IResponse } from '@core/models/response';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { VoterDetailsResponseAndHeader } from './voter-details.model';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';
@Injectable()
export class VoterDetailsResolver
  extends MobileAppBaseComponent
  implements Resolve<VoterDetailsResponseAndHeader | null>
{
  constructor(injector: Injector) {
    super(injector);
  }

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): VoterDetailsResponseAndHeader | Observable<VoterDetailsResponseAndHeader | null> {
    let voterId = route.queryParams['voterId'];
    let voterUniqueId = route.queryParams['voterUniqueId'];
    let trackingCode = route.queryParams['trackingCode'];
    let streamId = route.queryParams['streamId'];
    let serverId = route.queryParams['serverId'];
    let pollUniqueId = route.queryParams['pollUniqueId'];
    let pollId = route.queryParams['pollId'];
    let voterGuid = route.queryParams['voterGuid'];

    let url = AppConsts.apiBaseUrl + AppConsts.serverApis.voterDetails;
    let params: any = {
      id: voterId,
    };
    if (AppConsts.isMobile) {
      url = AppConsts.hybridUrl + AppConsts.pwaUrls.voterDetails;
      params = {
        id: voterId,
        voterUniqueId,
        trackingCode: trackingCode,
        streamId: streamId,
        serverId: serverId,
        pollUniqueId: pollUniqueId,
        pollId: pollId,
        voterGuid: voterGuid,
      };
    }
    return this.dataService.post<GetVoterFullDetail>(url, params).pipe(
      finalize(() => {}),
      map((response: IResponse<GetVoterFullDetail>) => {
        return {
          result: response.result,
          responseHeader: response.responseHeader,
        };
      }),
      catchError((error) => {
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
