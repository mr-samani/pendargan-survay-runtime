import { Injectable, signal } from '@angular/core';
import { GetDemographyDataForViewOutputDto } from '@core/models/backend-dto/GetDemographyDataForViewOutputDto';
import { FileTokenDataDto } from '@core/models/backend-dto/FileTokenDto';
import { GetPollDto } from '@core/models/backend-dto/GetPollDto';
import { FormChecksumDto } from '@core/models/backend-dto/FormChecksumDto';
import { QuestionsHasVariableTitleModel } from '@core/models/QuestionsHasVariableTitleModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { SectionModel } from '@core/models/SectionModel';
import { setInterval, clearInterval } from 'worker-timers';
import { AllocationTypeEnum } from '../allocation/allocation.model';
import { UserPosition } from '@core/location/location.interface';
import { VoterDataForEditParticipantDto } from '@core/models/backend-dto/VoterDataForEditParticipantDto';
import { FormulaModel } from '@core/models/FormulaModel';
import { GlobalVariableModel } from '@core/models/GlobalVariableModel';
import { GetAllPollRegionCapacityChildByPollId } from '@core/models/backend-dto/GetAllPollRegionCapacityChildByPollId';
import { EventEnum } from '@core/models/enums';

@Injectable()
export class VoteSharedService {
  lastVoterOfParticipant?: VoterDataForEditParticipantDto;
  /**
   *  شرکت کننده می تواند چندین بار در نظرسنجی شرکت کند
   */
  iPollHasUnlimitedParticipation?: boolean;
  /**
   * شرکت کننده میتواند فرم خود را رد کند و ثبت جدید بزند
   */
  allowRejectResultByParticipant?: boolean;
  /** کاربر بتواند بعد از ثبت فرم،مجددا برای همان فرم پاسخ جدید ثبت کند */
  hasReRegistrationForm!: boolean;
  formChecksum!: FormChecksumDto;
  isPreviewMode?: boolean;
  formGuid!: string;
  /** for edit */
  voterSequentialUniqueId?: string;
  showRequiredFormQuestionValidate = false;
  answerStates: any = {};

  endFormStack: any[] = [];

  progressBarValue = 0;

  pollData = new GetPollDto();
  formulaList: FormulaModel[] = [];
  gvarList: GlobalVariableModel[] = [];
  // سوالاتی که در متنشان متغییر استفاده شده است
  questionsHasVariable: QuestionsHasVariableTitleModel = {};
  sections: SectionModel[] = [];

  questionList: QuestionModel[] = [];

  pollRegionCapacityDto: GetAllPollRegionCapacityChildByPollId[] = [];

  timerCounter = 0;
  timer: any;

  // ایندکس سکشن جاری
  currentSectionPage = 0;

  /**** for pagination ******/
  isLoadingNext = false;
  isLoadingPrevious = false;

  pageQfrom = 0;
  pageSize = 0;
  // هر سوال در یک صفحه نشان داده شود
  oneQuestionPerPage = false;

  automaticGoToNextPage = false;

  // در حالت نمایش تک صفحه ای = در کدام صفحه هستیم
  pageOffset = 0;
  // برای بازگشت به صفحه قبل - در صفحه قبل چند سوال وجود داشته است
  lastPageSize: number[] = [0];
  public showPreviousButton = false;
  public showSubmitButton = false;

  voiceRecordToken?: FileTokenDataDto;
  userPosition?: UserPosition;

  lastRegionChildId?: string;
  demographyData?: GetDemographyDataForViewOutputDto;

  /**
   * استفاده از کد دستی در شماره سوال
   */
  useManualCode = false;
  // نمایش شماره سوالات
  showQuestionNumberInPollingPage = false;
  identificationCode!: number;

  pollTitle = '';
  pollDescription = '';
  /** نوع تخصیص : میدانی - تلفنی و ... */
  allocationType?: AllocationTypeEnum;

  /**
   * پرسش های قبل از این سوال باید غیر فعال شود
   * - هنگام ارسال فرم برای پرداخت، پرسش های قبل از آن باید غیر فعال شوند
   * - هنگام انصراف از پرداخت باید پرسش های قبلی تا پرسش پرداخت قبلی فقط فعال شوند
   */
  disablePreviousQuestionRowNumber = signal<{ questionUniqueId: string; rowNumber: number }[]>([]);

  /** ذخیره خودکار پاسخ های پرسش */
  autoSave = false;
  /** ذخیره موقت پرسشنامه توسط کاربر */
  saveTempVoter = false;

  titleButtonToParticipate = '';

  /** ذخیره موقت و ثبت نهایی با اطلاعات قبلی  */
  acceptPreviousData = false;

  languageName?: string = '';
  /**
   *نمایش پیام راهنما زمانی که کاربر در اپ موبایل بین برنامه های دیگر سوئیچ می کند
   * با جابجایی کاربر بین اپ های دیگر دیتای فرم به صورت موقت ذخیره میشود و مجددا بعد از باز شدن دوباره، لود میشود
   */
  showPwaLoadAnswersInfo: boolean = false;
  /** چشمک زدن دکمه نمایش راهنما در لود داده ها در اپ موبایل */
  showPwaLoadAnswersInfoFliker: boolean = true;

  /** نمایش فرم های تکمیل شده قبلی */
  showPreviousFilledForms: boolean = false;

  constructor() {}

  resetService() {
    this.formChecksum = new FormChecksumDto();
    this.isPreviewMode = false;
    this.formGuid = '';
    this.showRequiredFormQuestionValidate = false;
    this.answerStates = {};
    this.endFormStack = [];
    this.progressBarValue = 0;
    this.pollData = new GetPollDto();
    this.formulaList = [];
    this.gvarList = [];
    this.questionsHasVariable = {};
    this.sections = [];
    this.questionList = [];
    this.pollRegionCapacityDto = [];
    this.timerCounter = 0;
    this.timer = undefined;
    this.currentSectionPage = 0;
    /**** for pagination ******/
    this.isLoadingNext = false;
    this.isLoadingPrevious = false;
    this.pageQfrom = 0;
    this.pageSize = 0;
    this.oneQuestionPerPage = false;
    this.automaticGoToNextPage = false;
    this.pageOffset = 0;
    this.lastPageSize = [0];
    this.showPreviousButton = false;
    this.showSubmitButton = false;
    this.voiceRecordToken = undefined;
    this.userPosition = undefined;
    this.lastRegionChildId = undefined;
    this.demographyData = undefined;
    this.useManualCode = false;
    this.showQuestionNumberInPollingPage = false;
    this.identificationCode = 0;
    this.pollTitle = '';
    this.lastVoterOfParticipant = undefined;
    this.pollDescription = '';
    this.allocationType = undefined;
    this.voterSequentialUniqueId = undefined;
    this.disablePreviousQuestionRowNumber = signal<{ questionUniqueId: string; rowNumber: number }[]>([]);
    this.autoSave = false;
    this.saveTempVoter = false;
    this.showPwaLoadAnswersInfo = false;
    this.showPwaLoadAnswersInfoFliker = true;
  }

  validationHelper(name: string): any {
    return name;
  }

  startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.timerCounter++;
    }, 1000);
  }

  stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  getMessageAfterVoting(): string {
    if (!this.pollData || !this.pollData.messageAfterVoting || typeof this.pollData.messageAfterVoting !== 'string') {
      return '';
    }
    if (this.pollData.messageAfterVoting.includes('[%') == false) {
      this.pollData.messageAfterVoting;
    }

    const variableList = this.pollData.messageAfterVoting.match(/\[%.*?%\]/g) || [];
    let msg = this.pollData.messageAfterVoting;
    for (let v of variableList) {
      msg = msg.replace(v, this.answerStates[v] ?? '');
    }
    return msg;
  }

  startTimerToAnswerQuestion(question: QuestionModel) {
    question.isStartLimitationAnswer = true;
    question.timerCounter = question.settings?.timerQuestionSeconds ?? 60;
    if (question.timerInterval) {
      clearInterval(question.timerInterval);
    }
    question.timerInterval = setInterval(() => {
      question.timerCounter!--;
      question.timerCounterPrecentage =
        (question.timerCounter! / (question.settings?.timerQuestionSeconds ?? 60)) * 100;
      if (question.timerCounter! <= 0) {
        clearInterval(question.timerInterval);
        question.timerCounter = 0;
        app.event.trigger(EventEnum.TriggerEndOfTimerCounter + question.uniqueId, question);
      }
    }, 1000);
  }
}
