import { DIALOG_DATA } from '@angular/cdk/dialog';

import { AfterViewInit, Component, DOCUMENT, Inject, Injector, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { BaseComponent } from '@app/base.component';
import { SharedModule } from '@app/shared/shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { NgxScannerQrcodeComponent, ScannerQRCodeConfig, ScannerQRCodeDevice, LOAD_WASM } from 'ngx-scanner-qrcode';

// Barcode reader: Necessary to solve the problem of losing internet connection
LOAD_WASM().subscribe();
@Component({
  templateUrl: './barcode-reader.component.html',
  styleUrls: ['./barcode-reader.component.scss'],
  imports: [
    NgxScannerQrcodeComponent,
    MatDialogModule,
    TranslateModule,
    MatSelectModule,
    SharedModule,
    FormsModule,
    MatButtonModule,
  ],
})
export class BarCodeReaderComponent extends BaseComponent implements AfterViewInit, OnDestroy {
  title = 'Scanner';
  config: ScannerQRCodeConfig = {
    isBeep: false,
    constraints: {
      audio: false,
      video: {
        width: 500,
      },
    },
    fps: 10,
  };
  devices: ScannerQRCodeDevice[] = [];
  selectedDeviceId = '';
  @ViewChild('scanner', { static: false }) scanner!: NgxScannerQrcodeComponent;
  constructor(
    injector: Injector,
    @Inject(DIALOG_DATA) data: any,
    @Inject(DOCUMENT) private _document: Document,
    private dialogRef: MatDialogRef<BarCodeReaderComponent>,
  ) {
    super(injector);
  }

  ngAfterViewInit(): void {
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');

    this.scanner.start();
    this.scanner.devices.subscribe((d) => {
      this.devices = d;
      if (this.devices.length > 0) {
        this.selectedDeviceId = this.devices[0].deviceId;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.scanner && this.scanner.isStart) {
      this.scanner.stop();
    }
  }

  ok() {
    if (this.scanner.isStart) {
      this.scanner.stop();
    }
    this.scanner.deviceIndexActive;
    if (this.scanner && this.scanner.data.value.length > 0) {
      let code = this.scanner.data.value[0].value;
      this.dialogRef.close(code);
    } else {
      this.dialogRef.close();
    }
  }

  onChangeDevice() {
    this.scanner.playDevice(this.selectedDeviceId);
  }
}
