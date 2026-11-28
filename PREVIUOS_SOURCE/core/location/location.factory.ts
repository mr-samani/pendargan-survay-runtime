import { Injector } from '@angular/core';
import { ILocationService } from './location.interface';
import { AppConsts } from '@core/app-consts';
import { WebLocation } from './web-location';
import { XamarinLocation } from './xamarin-location';

export function locationServiceFactory(injector: Injector): ILocationService {
  if (AppConsts.isMobile) {
    return injector.get(XamarinLocation);
  } else {
    return injector.get(WebLocation);
  }
}
