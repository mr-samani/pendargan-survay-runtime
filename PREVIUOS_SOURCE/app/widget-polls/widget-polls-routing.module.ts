import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WidgetPollListResolver } from './poll-list/widget-poll-list.resolver';
import { WidgetPollListComponent } from './poll-list/widget-poll-list.component';

const routes: Routes = [{ path: ':tenant', component: WidgetPollListComponent, resolve: { data: WidgetPollListResolver } }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WidgetPollsRoutingModule {}
