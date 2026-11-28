import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header.component';
import { HeaderService } from '../header.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [HeaderComponent],
  imports: [CommonModule, MatMenuModule, MatButtonModule, RouterModule],
  exports: [HeaderComponent],
  providers: [HeaderService],
})
export class HeaderModule {}
