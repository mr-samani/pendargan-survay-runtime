import { inject, isDevMode } from '@angular/core';
import { AppConsts, ElasticConfig, HostEnum, OtlConfig } from '@core/app-consts';
import { IResponse } from '@core/models/response';
import { LanguageService } from '@core/services/language.service';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { map, finalize, catchError, of } from 'rxjs';
import { addAnalyticsScripts } from './analytics';
import { HttpClient } from '@angular/common/http';
import { initOpenTelemtry } from '../open-telemtry/setup';
import { ElasticService } from '../elastic/setup';
import { AppLocalData, IAppData } from './mobile-app/get-locale-data';

export function iniitlizeApp(): Promise<boolean> {
  const http = inject(HttpClient);
  const languageService = inject(LanguageService);
  const alert = inject(NgxAlertModalService);
  const elastic = inject(ElasticService);
  return new Promise<boolean>((resolve, reject): void => {
    console.log(
      '%c PENDARGAN',
      'font-weight: bold; font-size: 50px;color: #c9c9c9; text-shadow: 3px 3px 0 rgb(217,31,38) , 6px 6px 0 rgb(226,91,14) , 9px 9px 0 rgb(245,221,8) , 12px 12px 0 rgb(5,148,68) , 15px 15px 0 rgb(2,135,206) , 18px 18px 0 rgb(4,77,145) , 21px 21px 0 rgb(42,21,113); margin-bottom: 12px; padding: 2%',
    );

    const fileName = isDevMode() ? 'appconfig.json' : 'appconfig.production.json';
    console.time('appInit');
    http
      .get('assets/' + fileName + '?v=' + Math.random() * 1000)
      .pipe(
        map((resp: any) => {
          console.timeEnd('appInit');
          AppConsts.apiBaseUrl = resp.apiBaseUrl;
          AppConsts.remoteBaseUrl = resp.remoteBaseUrl;
          AppConsts.hybridUrl = resp.hybridUrl;
          AppConsts.baseUiUrl = resp.baseUiUrl;
          AppConsts.fileServerUrl = resp.fileServerUrl;
          AppConsts.profilePictureUrl = resp.profilePictureUrl;
          AppConsts.pollThemeBaseUrl = resp.pollThemeBaseUrl ?? resp.baseUiUrl;
          AppConsts.isMobile = resp.isMobile === true;
          AppConsts.recaptchaSiteKey = resp.recaptchaSiteKey;
          AppConsts.arCaptchaSiteKey = resp.arCaptchaSiteKey;
          AppConsts.useArCaptcha = resp.useArCaptcha;
          AppConsts.host = resp.host;
          AppConsts.loginUrl = resp.loginUrl;
          AppConsts.clientAuth = resp.clientAuth;
          AppConsts.expressionCaseSensitive = resp.expressionCaseSensitive;
          AppConsts.minimalLogo = resp.minimalLogo;
          AppConsts.enableHighAccuracyGPS = resp.enableHighAccuracyGPS;
          AppConsts.mapStyle = resp.mapStyle;
          AppConsts.otl = new OtlConfig(resp.otl);
          initOpenTelemtry();
          AppConsts.elastic = new ElasticConfig(resp.elastic);
          elastic.initElastic();

          // disable add clarity and another analytics script in localhost,mobile app and other sites except of pendargan
          if (
            !AppConsts.isKBrowser &&
            AppConsts.host == HostEnum.Pendargan &&
            window.location.hostname != 'localhost'
          ) {
            addAnalyticsScripts();
          }

          if (AppConsts.isMobile) {
            //تنظیم زبان برنامه
            const getLocaleUrl = AppConsts.hybridUrl + AppConsts.pwaUrls.getLocale;
            console.time('getLocale');
            http
              .post<IResponse<IAppData>>(getLocaleUrl, {})
              .pipe(finalize(() => console.timeEnd('getLocale')))
              .subscribe({
                next: (response) => {
                  if (response.result) {
                    AppLocalData.language = response.result.locale;
                    AppLocalData.data = response.result as any;
                    languageService.setPageLanguageAndDirection(response.result.locale);
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                },
                error: (err) => {
                  languageService.setPageLanguageAndDirection('fa-IR');
                  // AppLocalData.data = {
                  //   locale: 'fa-IR',
                  //   deviceId: 'dfE544565456#14',
                  //   userAccountData: 'احمدرضا عابدزاده',
                  // };
                  resolve(false);
                },
              });
          } else {
            resolve(true);
          }
        }),
        catchError((er) => {
          console.error(er?.error?.message, er);
          alert.show({
            text: 'Error on load appconfig!',
          });
          reject();
          return of();
        }),
      )
      .subscribe();
  });
}
