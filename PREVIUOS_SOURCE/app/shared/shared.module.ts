import { OnlineStatusComponent } from './online-status/online-status.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingAnimationComponent } from './loading-animation/loading-animation.component';
import { SpinnerComponent } from './spinner/spinner.component';
import { ArCaptchaComponent } from './ar-captcha/ar-captcha.component';

@NgModule({
  declarations: [LoadingAnimationComponent, SpinnerComponent, ArCaptchaComponent, OnlineStatusComponent],
  imports: [CommonModule],
  exports: [LoadingAnimationComponent, SpinnerComponent, ArCaptchaComponent, OnlineStatusComponent],
})
export class SharedModule {}
