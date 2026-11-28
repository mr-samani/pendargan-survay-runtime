import { Component, Inject, Injector, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FileData } from '../file-list.model';
import { MobileAppBaseComponent } from '@app/mobile-app/mobile-app-base-component';

@Component({
  standalone: false,
  selector: 'app-file-response-error',
  templateUrl: './file-response-error.component.html',
  styleUrl: './file-response-error.component.scss',
})
export class FileResponseErrorComponent extends MobileAppBaseComponent implements OnInit {
  title = '';
  fileInfo?: FileData;
  constructor(
    injector: Injector,
    private dialogRef: MatDialogRef<FileResponseErrorComponent>,
    @Inject(MAT_DIALOG_DATA) _data: FileData,
    private matDialog: MatDialog,
    
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
}
