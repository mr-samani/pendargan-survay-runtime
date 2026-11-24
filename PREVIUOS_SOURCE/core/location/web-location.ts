import { Injectable } from '@angular/core';
import { ILocationService, UserPosition } from './location.interface';
import { AppConsts } from '@core/app-consts';
import { LocationRequiredForVoterTypeEnum } from '@core/models/backend-dto/LocationRequiredForVoterTypeEnum';
import { GetPollDto } from '@core/models/backend-dto/GetPollDto';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class WebLocation implements ILocationService {
  minGPSAccuracyMeters = 100; // متر

  cachedUserPosition: UserPosition = {};
  constructor(
    private alert: NgxAlertModalService,
    private translateService: TranslateService,
  ) {}

  init(pollData: GetPollDto): void {
    this.minGPSAccuracyMeters = pollData.minGPSAccuracyMeters ? pollData.minGPSAccuracyMeters : 100;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          console.log('granted geolocation');
          this.getPosition(false);
        } else if (result.state === 'prompt') {
          console.log('prompt geolocation');
          this.getPosition(false);
        } else if (result.state === 'denied') {
          console.log('denied geolocation');
          this.checkLocationRequirment(pollData);
        }
        result.onchange = () => {
          console.log(result.state);
        };
      });
    } else {
      this.getPosition(false);
    }
  }

  getPosition(isSaveTemp: boolean): Promise<UserPosition> {
    return new Promise((resolve, reject) => {
      if (isSaveTemp) {
        resolve(this.cachedUserPosition);
      }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (resp) => {
            this.cachedUserPosition = {
              lng: resp.coords.longitude,
              lat: resp.coords.latitude,
              accuracyMeters: resp.coords.accuracy,
            };
            console.log(this.cachedUserPosition);
            resolve(this.cachedUserPosition);
          },
          (err) => {
            console.log('geolocation', err.message);
            reject(err);
          },
          { enableHighAccuracy: AppConsts.enableHighAccuracyGPS, maximumAge: 20000, timeout: 120000 },
        );
      } else {
        const msg = 'not support geolocation!';
        console.log(msg);
        reject(msg);
      }
    });
  }

  checkLocationRequirment(pollData: GetPollDto): void {
    const isRequired =
      pollData.locationRequeredForVoterType === LocationRequiredForVoterTypeEnum.RequiredForWeb ||
      pollData.locationRequeredForVoterType === LocationRequiredForVoterTypeEnum.RequiredForBoth;
    this.alert
      .show({
        title: this.translateService.instant('GeoLocation'),
        html: `<p class="text-danger">
               ${isRequired ? this.translateService.instant('YouAreNotAllowedToParticipate') : ''}
                </p>
                <p>
                ${this.translateService.instant('LocationAccessDenied')} 
                </p>
                <img src="assets/images/grant-location-permission.jpg" class="img-fluid" alt="location" />
                `,
        showCancelButton: !isRequired,
        allowEnterKey: true,
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonText: this.translateService.instant('CheckAgain'),
        cancelButtonText: this.translateService.instant('Continue'),
      })
      .then((result) => {
        if (isRequired || result.isConfirmed) window.location.reload();
      });
  }
}
