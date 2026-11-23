import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../vote/pipes/translate-pipe';
import { CommonModule } from '@angular/common';
import { HtmlSanatizePipe } from '../../vote/pipes/html-sanatizer.pipe';

@NgModule({
  imports: [FormsModule, TranslatePipe, HtmlSanatizePipe, CommonModule],
  exports: [FormsModule, TranslatePipe, HtmlSanatizePipe, CommonModule],
})
export class QuestionSharedModule {}
