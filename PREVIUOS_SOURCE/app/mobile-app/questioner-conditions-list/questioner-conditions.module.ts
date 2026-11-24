import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { QuestionerAllocationsRoutingModule } from './questioner-conditions-routing.module';
import { QuestionerConditionsListComponent } from './questioner-conditions-list.component';
import { AppCoreModule } from '@core/core.module';
import { MatButtonModule } from '@angular/material/button';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { SharedModule } from '@app/shared/shared.module';
import { MatProgressBarHarness } from '@angular/material/progress-bar/testing';
import { MaterialCommonModule } from '@core/material-common/material-common.module';

@NgModule({
  declarations: [QuestionerConditionsListComponent],
  imports: [
    CommonModule,
    QuestionerAllocationsRoutingModule,
    TranslateModule,
    FormsModule,
    NotFoundModule,
    AppCoreModule,
    MatButtonModule,
    InfiniteScrollModule,
    SharedModule,
    MaterialCommonModule,
  ],
  exports: [],
  providers: [],
})
export class QuestionerConditionsModule {}
