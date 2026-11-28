import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class HeaderService {
  showHeader = true;
  showBack = true;
  headerTitle = '';
  constructor(route: ActivatedRoute) {
    route.queryParams.subscribe((q) => {
      if (q['noHeader'] == 'true') {
        this.showHeader = false;
      }
    });
  }
}
