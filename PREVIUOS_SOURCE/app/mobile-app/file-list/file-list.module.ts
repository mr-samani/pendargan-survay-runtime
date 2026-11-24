import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { FileListRoutingModule } from './file-list-routing.module';
import { FileListComponent } from './file-list.component';
import { AppCoreModule } from '../../../core/core.module';
import { FileDetailComponent } from './file-detail/file-detail.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FileResponseErrorComponent } from './file-response-error/file-response-error.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [FileListComponent, FileDetailComponent, FileResponseErrorComponent],
  exports: [],
  providers: [],
  imports: [
    CommonModule,
    FileListRoutingModule,
    TranslateModule,
    FormsModule,
    NotFoundModule,
    AppCoreModule,
    MatDialogModule,
    MatButtonModule,
    SharedModule,
  ],
})
export class FileListModule {}
