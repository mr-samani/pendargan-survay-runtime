import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TextNumberComponent } from './text-number/text-number.component';
import { TextNumberRoutingModule } from './text-number-routing.module';
import { FormsModule } from '@angular/forms';
import { AppCoreModule } from '@core/core.module';
import { NumberCheckDirective } from '@core/directive/number-check.directive';
import { TableStickyResponsiveModule } from '../shared/table-sticky-resposive/table-sticky-responsive.module';

@NgModule({
  declarations: [TextNumberComponent],
  imports: [
    CommonModule,
    TextNumberRoutingModule,
    FormsModule,
    AppCoreModule,
    NumberCheckDirective,
    TableStickyResponsiveModule,
  ],
  exports: [],
})
export class TextNumberModule {}
