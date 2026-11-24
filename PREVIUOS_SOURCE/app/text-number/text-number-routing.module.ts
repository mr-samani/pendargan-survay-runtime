import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { TextNumberComponent } from './text-number/text-number.component';

const routes: Routes = [{ path: '', component: TextNumberComponent }];
@NgModule({
  declarations: [],
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TextNumberRoutingModule {}
