import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VoterDetailsComponent } from './voter-details.component';
import { VoterDetailsResolver } from './voter-details.resolver';

const routes: Routes = [{ path: '', component: VoterDetailsComponent, resolve: { data: VoterDetailsResolver } }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VoterDetailsRoutingModule {}
