import { Component, DOCUMENT, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
@Component({
  standalone: false,
  templateUrl: './sku-history.component.html',
  styleUrls: ['./sku-history.component.scss'],
})
export class SkuHistoryComponent implements OnInit {
  title = '';
  history = [];
  constructor(
    private dialogRef: MatDialogRef<SkuHistoryComponent>,
    @Inject(MAT_DIALOG_DATA) private data: any,
    @Inject(DOCUMENT) private _document: Document,
  ) {
    this.title = this.data.title;
    this.history = this.data.history ?? [];
  }

  ngOnInit(): void {
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
  }
  cancel(): void {
    this.dialogRef.close();
  }
}
