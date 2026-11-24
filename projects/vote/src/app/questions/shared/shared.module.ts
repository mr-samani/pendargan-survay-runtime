import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@vote/pipes/translate-pipe';
import { CommonModule } from '@angular/common';
import { HtmlSanatizePipe } from '@vote/pipes/html-sanatizer.pipe';
import { SpinnerComponent } from '@core/spinner/spinner.component';

const pipes = [TranslatePipe, HtmlSanatizePipe];
const comp = [SpinnerComponent];
const m = [CommonModule, FormsModule];
@NgModule({
  imports: [...m, ...comp, ...pipes],
  exports: [...m, ...comp, ...pipes],
})
export class QuestionSharedModule {}
