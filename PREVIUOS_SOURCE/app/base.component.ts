import { Injector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DataService } from '@core/services/data-service.service';
import { MainSpinnerService } from './main-spinner.service';
import { LanguageService } from '../core/services/language.service';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { PublicService } from '@core/services/public.service';
import { MobileVoterSpecificErrorCodes } from '@core/app-consts';

export abstract class BaseComponent {
  languageService: LanguageService;

  notify: ToastrService;
  dataService: DataService;
  translateService: TranslateService;
  mainSpinnerService: MainSpinnerService;
  route: ActivatedRoute;
  router: Router;
  publicService: PublicService;
  alert: NgxAlertModalService;
  constructor(injector: Injector) {
    this.languageService = injector.get(LanguageService);
    this.notify = injector.get(ToastrService);
    this.dataService = injector.get(DataService);
    this.translateService = injector.get(TranslateService);
    this.mainSpinnerService = injector.get(MainSpinnerService);
    this.route = injector.get(ActivatedRoute);
    this.router = injector.get(Router);
    this.languageService = injector.get(LanguageService);
    this.publicService = injector.get(PublicService);
    this.alert = injector.get(NgxAlertModalService);
  }

  handleApiError(exp: any, closeAfterDone = true) {
    if (exp.messageIsShowed) return;

    let msg = exp?.error?.message;
    let msgDetails = exp?.error?.details;
    let msgTitle = msg ?? this.translateService.instant('AnErrorOccurredOnTheServer');

    let erCode = exp?.error?.code ?? 0;
    if (erCode == MobileVoterSpecificErrorCodes.EnteredIdentityNotFound) {
      msgTitle = this.translateService.instant('XamarinYouAreNotAllowedToParticipate');
      msgDetails = this.translateService.instant('XamarinYouAreNotAllowedToParticipateDetails');
    }

    this.alert
      .show({
        title: msgTitle,
        html: msgDetails ? '<pre>' + msgDetails + '</pre>' : '',
        confirmButtonText: this.translateService.instant('Ok'),
      })
      .then((result) => {
        if (closeAfterDone) this.publicService.closeWindow();
      });
  }
}
