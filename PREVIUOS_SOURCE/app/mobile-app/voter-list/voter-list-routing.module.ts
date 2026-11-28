import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VoterListComponent } from './voter-list.component';

const routes: Routes = [{ path: '', component: VoterListComponent }];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VoterListRoutingModule {}
