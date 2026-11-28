import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PaymentResultRoutingModule } from './payment-result-routing.module';
import { PaymentResultComponent } from './payment-result.component';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@app/shared/shared.module';

@NgModule({
  declarations: [PaymentResultComponent],
  imports: [CommonModule, PaymentResultRoutingModule, TranslateModule, SharedModule],
})
export class PaymentResultModule {}
