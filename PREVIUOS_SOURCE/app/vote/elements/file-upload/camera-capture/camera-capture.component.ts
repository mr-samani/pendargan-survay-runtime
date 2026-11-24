
import { Component, ElementRef, Injector, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@app/shared/shared.module';

@Component({
  selector: 'app-camera-capture',
  templateUrl: './camera-capture.component.html',
  styleUrls: ['./camera-capture.component.scss'],
  standalone: true,
  imports: [MaterialCommonModule, TranslateModule, FormsModule, SharedModule],
})
export class CameraCaptureComponent extends VoteBaseComponent implements OnInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  stream: MediaStream | null = null;
  capturedImageUrl: string | null = null;
  errorMessage: string | null = null;

  videoDevices: MediaDeviceInfo[] = [];
  selectedDeviceId = '';

  isSaving = false;
  constructor(
    injector: Injector,
    private matDialogRef: MatDialogRef<CameraCaptureComponent>,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
    
    this.getDeciveList();
  }

  async getDeciveList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.videoDevices = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
    if (this.videoDevices.length > 0) {
      this.selectedDeviceId = this.videoDevices[0].deviceId;
    }
    this.startCamera();
  }

  async startCamera() {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }

      this.capturedImageUrl = '';
      this.errorMessage = null;
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          width: { ideal: 4096 }, // تلاش برای بالاترین رزولوشن ممکن
          height: { ideal: 2160 },
        },
      });

      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve(null);
        };
      });
    } catch (err: any) {
      this.errorMessage = this.translateService.instant('CameraAccessDenied');
      console.error('Error accessing camera:', err);
    }
  }

  capturePhoto() {
    if (!this.videoRef || !this.canvasRef) return;

    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image as Base64
    this.capturedImageUrl = canvas.toDataURL('image/png');
    this.stopCamera();
  }

  stopCamera() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
  onChangeDevice() {
    this.startCamera();
  }
  ok() {
    try {
      this.isSaving = true;
      const canvas = this.canvasRef.nativeElement;
      canvas.toBlob((blob) => {
        if (blob) {
          let file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          this.matDialogRef.close(file);
        }
      }, 'image/jpeg');
    } catch (error) {
      this.isSaving = false;
      console.log('Error on conver image', error);
    }
  }
}
