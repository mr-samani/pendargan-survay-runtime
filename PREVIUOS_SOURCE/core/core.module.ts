import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ArraySortPipe } from './pipe/array-sort.pipe';
import { ArrayRandomizePipe } from './pipe/randomize.pipe';
import { CustomEmailDirective } from './custom-validator/email-validator';
import { HtmlSanatizePipe } from './pipe/html-sanatizer.pipe';
import { CustomMaxDirective, CustomMinDirective } from './pipe/min-max-validator';
import { MatrixRandomizePipe } from './pipe/randomize-matrix.pipe';
import { SecendToTimePipe } from './pipe/secend-to-time';
import { LuxonFormatPipe } from './pipe/luxon-format.pipe';
import { FocusDirective } from './directive/focus.directive';
import { CheckShowRowMatrixDirective } from './directive/check-show-row-matrix.directive';
import { CheckShowColumnMatrixDirective } from './directive/check-show-column-matrix.directive';
import { HumanizeFileSizePipe } from './pipe/humanize-file-size.pipe';
import { StripHtmlPipe } from './pipe/strip-html.pipe';
import { ReadSmsCodeDirective } from './directive/read-sms-code.directive';
import { FileServerUrlPipe } from './pipe/file-server-url.pipe';
import { HighlightPipe } from './pipe/highlight.pipe';

const pipes = [
  ArraySortPipe,
  ArrayRandomizePipe,
  MatrixRandomizePipe,
  HtmlSanatizePipe,
  HumanizeFileSizePipe,
  SecendToTimePipe,
  LuxonFormatPipe,
  StripHtmlPipe,
  FileServerUrlPipe,
  HighlightPipe,
];
const directives = [
  CustomEmailDirective,
  CustomMinDirective,
  CustomMaxDirective,
  FocusDirective,
  CheckShowRowMatrixDirective,
  CheckShowColumnMatrixDirective,
  ReadSmsCodeDirective,
];

@NgModule({
  declarations: [...pipes, ...directives],
  imports: [FormsModule, ReactiveFormsModule],
  providers: [],
  exports: [...pipes, ...directives],
})
export class AppCoreModule {}
