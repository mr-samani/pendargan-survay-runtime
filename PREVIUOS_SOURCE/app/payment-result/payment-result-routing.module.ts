import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PaymentResultComponent } from './payment-result.component';

const routes: Routes = [{ path: '', component: PaymentResultComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PaymentResultRoutingModule {}
