import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { QuestionerAllocationsRoutingModule } from './allocation-routing.module';
import { AllocationListComponent } from './allocation-list.component';
import { AllocationListResolver } from './allocation-list.resolver';
import { AppCoreModule } from '@core/core.module';
import { MatButtonModule } from '@angular/material/button';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

@NgModule({
  declarations: [AllocationListComponent],
  imports: [
    CommonModule,
    QuestionerAllocationsRoutingModule,
    TranslateModule,
    FormsModule,
    NotFoundModule,
    AppCoreModule,
    MatButtonModule,
    InfiniteScrollModule,
  ],
  exports: [],
  providers: [AllocationListResolver],
})
export class QuestionerAllocationsModule {}
