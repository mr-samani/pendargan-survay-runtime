import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TableStickyResponsiveComponent } from './table-sticky-resposive.component';
import { TBodyDirective } from './tbody.directive';
import { THeadDirective } from './thead.directive';

@NgModule({
  declarations: [TableStickyResponsiveComponent, TBodyDirective, THeadDirective],
  imports: [CommonModule],
  exports: [TableStickyResponsiveComponent, TBodyDirective, THeadDirective],
})
export class TableStickyResponsiveModule {}
