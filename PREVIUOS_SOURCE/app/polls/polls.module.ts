import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PollsRoutingModule } from './polls-routing.module';
import { PollListComponent } from './poll-list/poll-list.component';
import { PollListResolver } from './poll-list/poll-list.resolver';
import { TranslateModule } from '@ngx-translate/core';
import { AppCoreModule } from '../../core/core.module';
import { NotFoundModule } from '../shared/no-result-found/not-found.module';

@NgModule({
  declarations: [PollListComponent],
  providers: [PollListResolver],
  imports: [CommonModule, PollsRoutingModule, TranslateModule, AppCoreModule, NotFoundModule],
})
export class PollsModule {}
