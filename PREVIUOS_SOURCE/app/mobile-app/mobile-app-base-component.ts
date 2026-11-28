import { DOCUMENT, Injector } from '@angular/core';
import { BaseComponent } from '@app/base.component';
import { HeaderService } from './layouts/header.service';

export abstract class MobileAppBaseComponent extends BaseComponent {
  public headerService: HeaderService;
  public _document: Document;
  constructor(injector: Injector) {
    super(injector);
    this.headerService = injector.get(HeaderService);
    this._document = injector.get(DOCUMENT);
  }
}
