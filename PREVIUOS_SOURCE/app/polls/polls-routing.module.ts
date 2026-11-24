import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PollListComponent } from './poll-list/poll-list.component';
import { PollListResolver } from './poll-list/poll-list.resolver';

const routes: Routes = [{ path: '', component: PollListComponent, resolve: { data: PollListResolver } }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PollsRoutingModule {}
