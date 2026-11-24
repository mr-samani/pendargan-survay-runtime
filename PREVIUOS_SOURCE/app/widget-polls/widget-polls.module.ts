import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WidgetPollsRoutingModule } from './widget-polls-routing.module';
import { WidgetPollListComponent } from './poll-list/widget-poll-list.component';
import { WidgetPollListResolver } from './poll-list/widget-poll-list.resolver';
import { TranslateModule } from '@ngx-translate/core';
import { AppCoreModule } from '../../core/core.module';
import { NotFoundModule } from '../shared/no-result-found/not-found.module';

@NgModule({
  declarations: [WidgetPollListComponent],
  providers: [WidgetPollListResolver],
  imports: [CommonModule, WidgetPollsRoutingModule, TranslateModule, AppCoreModule, NotFoundModule],
})
export class WidgetPollsModule {}
