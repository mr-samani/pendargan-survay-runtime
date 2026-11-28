import { SubmitResultComponent } from './submit-result/submit-result.component';
import { Injector, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoteRoutingModule } from './vote-routing.module';
import { VoteComponent } from './vote.component';
import { CustomTextBoxComponent } from './elements/custom-text-box/custom-text-box.component';
import { DateComponent } from './elements/date/date.component';
import { DropDownComponent } from './elements/drop-down/drop-down.component';
import { DynamicAnswerComponent } from './elements/dynamic-answer/dynamic-answer.component';
import { EmojiComponent } from './elements/emoji/emoji.component';
import { FileUploadPWAComponent } from './elements/file-upload-pwa/file-upload-pwa.component';
import { FileUploadComponent } from './elements/file-upload/file-upload.component';
import { HasPriorityComponent } from './elements/has-priority/has-priority.component';
import { HtmlComponent } from './elements/html/html.component';
import { MatrixDynamicComponent } from './elements/matrix-dynamic/matrix-dynamic.component';
import { MatrixComponent } from './elements/matrix/matrix.component';
import { MultiSelectComponent } from './elements/multi-select/multi-select.component';
import { NumericComponent } from './elements/numeric/numeric.component';
import { PointScaleComponent } from './elements/point-scale/point-scale.component';
import { PointComponent } from './elements/point/point.component';
import { PointRatingComponent } from './elements/rating/rating.component';
import { SkuCountDynamicComponent } from './elements/sku-count-dynamic/sku-count-dynamic.component';
import { SkuHistoryComponent } from './elements/sku-count-dynamic/sku-history/sku-history.component';
import { SkuCountComponent } from './elements/sku-count/sku-count.component';
import { TimeComponent } from './elements/time/time.component';
import { UniqueSelectComponent } from './elements/unique-select/unique-select.component';
import { RegionAutoCompleteComponent } from './elements/regions/region-auto-complete/region-auto-complete.component';
import { RegionsComponent } from './elements/regions/regions.component';
import { ViewDemographicComponent } from './elements/view-demographic/view-demographic.component';
import { HeaderComponent } from './header/header.component';
import { PollInfoComponent } from './poll-info/poll-info.component';
import { TimerCounterComponent } from './timer-counter/timer-counter.component';
import { TwoFactorAuthenticationDialogComponent } from './two-factor-authentication/two-factor-authentication.component';
import { VoteFooterComponent } from './vote-footer/vote-footer.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { LocalStoreService } from './services/local-store.service';
import { SaveTemporaryService } from './services/temporary.service';
import { VoteSharedService } from './services/vote-service';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { AppCoreModule } from '@core/core.module';
import { TranslateModule } from '@ngx-translate/core';
import { VoteThemeService } from './services/theme.service';
import { LogicService } from './services/logic.service';
import { AllocationComponent } from './allocation/allocation.component';
import { ImageChooserComponent } from './elements/image-chooser/image-chooser.component';
import { ConverterDataService } from './services/converter-data.service';
import { RetailAuditChildsComponent } from './elements/retail-audit/retail-audit-childs/retail-audit-childs.component';
import { RetailAuditComponent } from './elements/retail-audit/retail-audit.component';
import { ElementBuilder } from './elements/_element-builder/element-builder.component';
import { RecordsOtherFormsComponent } from './elements/records-other-forms/records-other-forms.component';
import { NumberCheckDirective } from '@core/directive/number-check.directive';
import { TableStickyResponsiveModule } from '../shared/table-sticky-resposive/table-sticky-responsive.module';
import { PopupComponent } from './elements/popup/popup.component';
import { SectionDialogComponent } from './elements/popup/section-dialog/section-dialog.component';
import { QuestionTitleComponent } from './elements/question-title/question-title.component';
import { CaptchaQuestionComponent } from './elements/captcha/captcha.component';
import { BotDetectCaptchaModule } from './elements/captcha/angular-captcha-bot-detect-lib/botdetect-captcha.module';
import { VoiceQuestionComponent } from './elements/voice-question/voice-question.component';
import { MobileEmailComponent } from './elements/mobile-email/mobile-email.component';
import { PaymentQuestionComponent } from './elements/payment/payment.component';
import { SignalRService } from '@core/services/signalr.service';
import { SaveVoteService } from './services/save-vote.service';
import { locationServiceFactory } from '@core/location/location.factory';
import { LOCATION_SERVICE } from '@core/location/location.token';
import { WebLocation } from '@core/location/web-location';
import { XamarinLocation } from '@core/location/xamarin-location';
import { LocationQuestionComponent } from './elements/location/location.component';
import { WebVoiceRecorder } from '@core/voice-record/web-voice-recorder';
import { XamarinVoiceRecorder } from '@core/voice-record/xamarin-voice-recorder';
import { KBrowserVoiceRecorder } from '@core/voice-record/kbrowser-voice-recorder';
import { VOICE_RECORD_SERVICE } from '@core/voice-record/voice-record.token';
import { voiceRecordFactory } from '@core/voice-record/voice-record.factory';
import { CustomMaskQuestionComponent } from './elements/custom-mask/custom-mask.component';
import { NgxMatTimepickerModule } from 'ngx-mat-timepicker';
import { FilledFormsComponent } from './filled-forms/filled-forms.component';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { RunVoteLogComponent } from './run-vote-log/run-vote-log.component';

const questionElements = [
  QuestionTitleComponent,
  ElementBuilder,
  MultiSelectComponent,
  UniqueSelectComponent,
  DropDownComponent,
  CustomTextBoxComponent,
  MobileEmailComponent,
  NumericComponent,
  DateComponent,
  TimeComponent,
  HasPriorityComponent,
  MatrixComponent,
  PointComponent,
  PointRatingComponent,
  DynamicAnswerComponent,
  FileUploadComponent,
  FileUploadPWAComponent,
  HtmlComponent,
  SkuCountComponent,
  SkuCountDynamicComponent,
  SkuHistoryComponent,
  PointScaleComponent,
  MatrixDynamicComponent,
  EmojiComponent,
  ImageChooserComponent,
  RetailAuditComponent,
  RetailAuditChildsComponent,
  RecordsOtherFormsComponent,
  PopupComponent,
  SectionDialogComponent,
  CaptchaQuestionComponent,
  VoiceQuestionComponent,
  PaymentQuestionComponent,
  LocationQuestionComponent,
  CustomMaskQuestionComponent,
];

@NgModule({
  declarations: [
    VoteComponent,
    RunVoteLogComponent,
    ...questionElements,
    RegionsComponent,
    RegionAutoCompleteComponent,
    VoteFooterComponent,
    TwoFactorAuthenticationDialogComponent,
    ViewDemographicComponent,
    PollInfoComponent,
    TimerCounterComponent,
    AllocationComponent,
    SubmitResultComponent,
    FilledFormsComponent,
  ],
  imports: [
    CommonModule,
    VoteRoutingModule,
    AppCoreModule,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule,
    MaterialCommonModule,
    TranslateModule,
    NumberCheckDirective,
    TableStickyResponsiveModule,
    BotDetectCaptchaModule,
    HeaderComponent,
    NgxMatTimepickerModule,
    NotFoundModule,
  ],
  providers: [
    VoteSharedService,
    LocalStoreService,
    SaveTemporaryService,
    VoteThemeService,
    LogicService,
    ConverterDataService,
    SignalRService,
    SaveVoteService,

    /// ---- location service
    WebLocation,
    XamarinLocation,
    { provide: LOCATION_SERVICE, useFactory: locationServiceFactory, deps: [Injector] },

    // --- voice recorder
    WebVoiceRecorder,
    XamarinVoiceRecorder,
    KBrowserVoiceRecorder,
    { provide: VOICE_RECORD_SERVICE, useFactory: voiceRecordFactory, deps: [Injector] },
  ],
})
export class VoteModule {}
