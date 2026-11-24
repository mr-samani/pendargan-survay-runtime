import { Injectable } from '@angular/core';
import { ILocationService, UserPosition } from './location.interface';
import { AppConsts } from '@core/app-consts';
import { DataService } from '@core/services/data-service.service';
import { MainSpinnerService } from '@app/main-spinner.service';
import { GetLocationOutput } from '@core/models/xamarin';
import { finalize } from 'rxjs';
import { GetPollDto } from '@core/models/backend-dto/GetPollDto';

@Injectable()
export class XamarinLocation implements ILocationService {
  minGPSAccuracyMeters = 100; // متر
  hasForcePresentLocation = false;
  forcePresentLocationRange?: number = 0;
  cachedUserPosition: UserPosition = {};

  constructor(
    private dataService: DataService,
    private mainSpinnerService: MainSpinnerService,
  ) {}

  init(pollData: GetPollDto): void {
    this.minGPSAccuracyMeters = pollData.minGPSAccuracyMeters ? pollData.minGPSAccuracyMeters : 100;
    this.hasForcePresentLocation = pollData.hasForcePresentLocation;
    this.forcePresentLocationRange = pollData.forcePresentLocationRange;
    // this.mainSpinnerService.showLoading = true;
    this.dataService
      .post(AppConsts.hybridUrl + AppConsts.pwaUrls.startPwaAcquiringLocation, {
        requiredAccuracyMeters: this.minGPSAccuracyMeters,
      })
      .subscribe({
        next: (resp) => {
          console.log('start xamarin get location', resp);
        },
        error: (err) => {
          console.log('start xamarin get location', err);
        },
      });
    // .pipe(finalize(() =>this.mainSpinnerService.showLoading = false))
  }

  getPosition(isSaveTemp: boolean): Promise<UserPosition> {
    return new Promise((resolve, reject) => {
      if (isSaveTemp) {
        resolve(this.cachedUserPosition);
      }
      this.mainSpinnerService.showLoading = true;
      this.dataService
        .post<GetLocationOutput>(AppConsts.hybridUrl + AppConsts.pwaUrls.getPwaLocation, {
          requiredAccuracyMeters: this.minGPSAccuracyMeters,
          hasForcePresentLocation: this.hasForcePresentLocation,
          forcePresentLocationRange: this.forcePresentLocationRange,
        })
        .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
        .subscribe({
          next: (resp) => {
            let result = resp?.result;
            if (result && result.latitude && result.longitude) {
              this.cachedUserPosition = {
                lng: result.longitude,
                lat: result.latitude,
                accuracyMeters: result.accuracyMeters,
              };
              resolve(this.cachedUserPosition);
            } else {
              reject(new Error('get empty location from mobile app!'));
            }
          },
          error: (err) => {
            reject(err);
          },
        });
    });
  }
}
