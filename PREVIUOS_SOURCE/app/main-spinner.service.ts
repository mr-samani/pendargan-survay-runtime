import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MainSpinnerService {
  showLoading = false;
  constructor() {}
}
