
import { AfterViewInit, Component, Inject, DOCUMENT } from '@angular/core';

@Component({
  standalone: false,
  selector: 'mobile-app',
  templateUrl: './mobile-app.component.html',
  styleUrls: ['./mobile-app.component.scss'],
})
export class MobileAppComponent implements AfterViewInit {
  constructor(@Inject(DOCUMENT) private _document: Document) {}
  ngAfterViewInit(): void {
    this._document.querySelector('style#dynamic-theme-css')?.remove();
  }
}
