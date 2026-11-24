import { NgModule } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MAT_DATE_FORMATS,
  MatNativeDateModule,
  MAT_RIPPLE_GLOBAL_OPTIONS,
  RippleGlobalOptions,
} from '@angular/material/core';
import { MaterialJalaliDateAdapter, PERSIAN_DATE_FORMATS } from '../localization/jalali/material-jalali-date-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MAT_LUXON_DATE_FORMATS,
  LuxonDateAdapter,
  MAT_LUXON_DATE_ADAPTER_OPTIONS,
} from '@angular/material-luxon-adapter';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatSelectModule } from '@angular/material/select';
import { TranslateService } from '@ngx-translate/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { DragPreviewRtlDirective } from './drag-preview-rtl.directive';
export function getLanguage(localizationService: TranslateService) {
  return localizationService.currentLang;
}
export function getDateFormat(locale: string) {
  if (locale === 'fa-IR' || locale === 'fa') {
    return PERSIAN_DATE_FORMATS;
  } else {
    return MAT_LUXON_DATE_FORMATS;
  }
}
export function getDateProvider(locale: string) {
  if (locale === 'fa-IR' || locale === 'fa') {
    return new MaterialJalaliDateAdapter(locale);
  } else {
    return new LuxonDateAdapter(locale);
  }
}
const globalRippleConfig: RippleGlobalOptions = {
  disabled: true,
  animation: {
    enterDuration: 0,
    exitDuration: 0,
  },
};
const material = [
  DragPreviewRtlDirective,
  MatInputModule,
  MatFormFieldModule,
  MatSelectModule,
  MatNativeDateModule,
  MatProgressSpinnerModule,
  MatProgressBarModule,
  MatButtonModule,
  MatDialogModule,
  MatRadioModule,
  DragDropModule,
  MatAutocompleteModule,
  MatMenuModule,
  ClipboardModule,
  MatListModule,
  MatDatepickerModule,
];
@NgModule({
  declarations: [],
  imports: [...material],
  exports: [...material],
  providers: [
    { provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: globalRippleConfig },
    { provide: MAT_LUXON_DATE_ADAPTER_OPTIONS, useValue: { useUtc: false } },
    { provide: MAT_DATE_LOCALE, useFactory: getLanguage, deps: [TranslateService] },
    { provide: MAT_DATE_FORMATS, useFactory: getDateFormat, deps: [MAT_DATE_LOCALE] },
    { provide: DateAdapter, useFactory: getDateProvider, deps: [MAT_DATE_LOCALE] },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: <MatDialogConfig>{
        hasBackdrop: true,
        disableClose: true,
        panelClass: 'custom-dialog',
      },
    },
  ],
})
export class MaterialCommonModule {}
