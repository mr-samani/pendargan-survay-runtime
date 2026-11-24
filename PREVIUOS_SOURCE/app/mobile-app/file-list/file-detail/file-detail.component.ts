import { ChangeDetectorRef, Component, Inject, Injector, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FileData } from '../file-list.model';
import { FileResponseErrorComponent } from '../file-response-error/file-response-error.component';
import { MobileAppBaseComponent } from '@app/mobile-app/mobile-app-base-component';
import { AppConsts } from '@core/app-consts';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { IResponse } from '@core/models/response';

@Component({
  standalone: false,
  selector: 'app-file-detail',
  templateUrl: './file-detail.component.html',
  styleUrl: './file-detail.component.scss',
})
export class FileDetailComponent extends MobileAppBaseComponent implements OnInit {
  title = '';
  fileInfo?: FileData;
  constructor(
    injector: Injector,
    private dialogRef: MatDialogRef<FileDetailComponent>,
    @Inject(MAT_DIALOG_DATA) _data: FileData,
    private matDialog: MatDialog,
    private http: HttpClient,
    private chd: ChangeDetectorRef,
  ) {
    super(injector);
    this.title = _data.fileName;
    this.fileInfo = _data;
  }

  ngOnInit(): void {
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
  }

  openDetailErrorDialog() {
    this.matDialog.open(FileResponseErrorComponent, {
      data: this.fileInfo,
      width: '80vw',
      direction: this.languageService.direction,
      panelClass: 'custom-dialog',
    });
  }

  resendFile() {
    if (!this.fileInfo) return;
    this.mainSpinnerService.showLoading = true;
    const url = AppConsts.hybridUrl + AppConsts.pwaUrls.resendFile;
    var params = {
      fileIdUnique: this.fileInfo.uniqueId,
    };
    this.http
      .post<IResponse<{ canRetry: boolean }>>(url, params)
      .pipe(
        finalize(() => (this.mainSpinnerService.showLoading = false)),
        catchError((error) => {
          this.handleApiError(error, true);
          return of(null);
        }),
      )
      .subscribe((response) => {
        if (response && response.result) {
          this.fileInfo!.canRetry = response.result.canRetry;
          this.chd.detectChanges();
          console.log('api result resendFile', response);
        }
      });
  }
}
