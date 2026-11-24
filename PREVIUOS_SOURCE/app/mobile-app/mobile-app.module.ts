import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HeaderModule } from './layouts/header/header.module';

import { AppRoutingModule } from './mobile-app-routing.module';
import { MobileAppComponent } from './mobile-app.component';
import { LocaleDataComponent } from './locale-data/locale-data.component';

@NgModule({
  declarations: [MobileAppComponent],
  imports: [CommonModule, AppRoutingModule, HeaderModule, LocaleDataComponent],
  providers: [],
})
export class MobileAppModule {}
