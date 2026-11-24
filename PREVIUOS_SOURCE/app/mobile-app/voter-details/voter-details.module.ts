import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { VoterDetailsRoutingModule } from './voter-details-routing.module';
import { VoterDetailsComponent } from './voter-details.component';
import { TranslateModule } from '@ngx-translate/core';
import { AppCoreModule } from '@core/core.module';
import { MatButtonModule } from '@angular/material/button';
import { VoterDetailsResolver } from './voter-details.resolver';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { ViewFileUploadQuestionComponent } from './file-upload/file-upload.component';
import { ViewMatrixDynamicQuestionComponent } from './matrix-dynamic/view-matrix-dynamic.component';
import { ViewMatrixQuestionComponent } from './matrix/view-matrix.component';
import { ViewSelectImageQuestionComponent } from './select-image/select-image.component';
import { ViewSkuQuestionComponent } from './sku/sku.component';
import { ViewDemographicComponent } from './view-demographic/view-demographic.component';
import { ViewCaptchaQuestionComponent } from './captcha/captcha.component';
import { ViewLocationQuestionComponent } from './location/location.component';
import { ViewMobileEmailQuestionComponent } from './mobile-email/mobile-email.component';
import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { ViewPaymentQuestionComponent } from './payment/payment.component';

@NgModule({
  declarations: [
    VoterDetailsComponent,
    ViewMatrixQuestionComponent,
    ViewMatrixDynamicQuestionComponent,
    ViewFileUploadQuestionComponent,
    ViewSelectImageQuestionComponent,
    ViewSkuQuestionComponent,
    ViewDemographicComponent,
    ViewCaptchaQuestionComponent,
    ViewLocationQuestionComponent,
    ViewMobileEmailQuestionComponent,
    ViewPaymentQuestionComponent,
  ],
  imports: [
    CommonModule,
    VoterDetailsRoutingModule,
    TranslateModule,
    AppCoreModule,
    MatButtonModule,
    NotFoundModule,
    CdkCopyToClipboard,
  ],
  providers: [VoterDetailsResolver],
  exports: [VoterDetailsComponent],
})
export class VoterDetailsModule {}
