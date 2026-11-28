import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { TranslateModule } from '@ngx-translate/core';
import { MatPaginatorModule } from '@angular/material/paginator';

const m = [
  CommonModule,
  MaterialCommonModule,
  ReactiveFormsModule,
  TranslateModule,
  MatTabsModule,
  FormsModule,
  MatPaginatorModule,
];
@NgModule({
  imports: [...m],
  exports: [...m],
})
export class SharedVoteFlowModule {}
