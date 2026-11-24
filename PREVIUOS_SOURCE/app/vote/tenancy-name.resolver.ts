import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, MaybeAsync, RedirectCommand, Resolve, RouterStateSnapshot } from '@angular/router';
import { AppConsts } from '@core/app-consts';

@Injectable({ providedIn: 'root' })
export class TenancyNameResolver implements Resolve<string> {
  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<string | RedirectCommand> {
    AppConsts.tenancyName = route.params['tenancyName'] || '';
    return AppConsts.tenancyName;
  }
}
