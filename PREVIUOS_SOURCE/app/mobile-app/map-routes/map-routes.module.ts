import { AutoCompleteSearchPointComponent } from './auto-complete-search-point/auto-complete-search-point.component';
import { MapRoutesComponent } from './map-routes/map-routes.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapRoutesRoutingModule } from './map-routes-routing.module';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppCoreModule } from '@core/core.module';

@NgModule({
  declarations: [MapRoutesComponent, AutoCompleteSearchPointComponent],
  imports: [
    CommonModule,
    MapRoutesRoutingModule,
    MaterialCommonModule,
    TranslateModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    AppCoreModule,
  ],
})
export class MapRoutesModule {}
