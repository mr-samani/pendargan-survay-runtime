import { InjectionToken } from '@angular/core';
import { ILocationService } from './location.interface';

export const LOCATION_SERVICE = new InjectionToken<ILocationService>('LocationService');
