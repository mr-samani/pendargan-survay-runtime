import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MapRoutesComponent } from './map-routes/map-routes.component';

//https://localhost:4444/app/map-routes?dynamicDataId=1167
const routes: Routes = [{ path: '', component: MapRoutesComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MapRoutesRoutingModule {}
