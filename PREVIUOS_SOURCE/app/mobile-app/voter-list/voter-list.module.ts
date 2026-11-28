import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { VoterListRoutingModule } from './voter-list-routing.module';
import { VoterListComponent } from './voter-list.component';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '@app/shared/shared.module';

@NgModule({
  declarations: [VoterListComponent],
  imports: [
    CommonModule,
    VoterListRoutingModule,
    TranslateModule,
    FormsModule,
    NotFoundModule,
    MatTabsModule,
    SharedModule,
  ],
  exports: [],
  providers: [],
})
export class VoterListModule {}
