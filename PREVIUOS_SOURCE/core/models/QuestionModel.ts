import { AdditionalSettingRecord, validationAdditionalSettings } from '@app/vote/helpers/additional-settings-validate';
import { ArraySortPipe } from '@core/pipe/array-sort.pipe';
import { ArrayRandomizePipe } from '@core/pipe/randomize.pipe';
import { GetFormQuestionQuestionOptionDto } from './backend-dto/GetFormQuestionQuestionOptionDto';
import { FormQuestionTypesEnum } from './backend-dto/FormQuestionTypesEnum';
import { AnswerModel } from './AnswerModel';
import { SelectedSkuIteModel } from './SelectedSkuIteModel';

export class QuestionModel extends GetFormQuestionQuestionOptionDto {
  override questionOptions: AnswerModel[];

  // ----------------------------
  descriptionAnswer?: string;
  // اگر پرسش توضیح داشت و نوع آن گزینه انتخابی بود بعد از انتخاب آن گزینه این فیلد فعال می شود
  showDescription?: boolean;
  originalTitle?: string;
  originalDescription?: string;
  dontShow?: boolean;
  // اگر سوالات ماتریسی فرزند نداشتند سوال والد هم نشان داده نشود  // یا گزینه ای بود و گزینه ای نداشت
  hasVisibleQuestionOrOption?: boolean;
  answer?: any;
  invalid?: boolean;
  endForm?: boolean;
  selectedCount?: number;
  answerTitle?: string;
  // مقدار اجرا شده فیلتر برای پاسخ پویا
  fieldValueFilter?: string;
  // list of selected item in sku count
  selectedList: SelectedSkuIteModel[] = [];
  // مقدار اجرا شده initialValue برای لیست شمارش موجودی داینامیک
  secondaryFieldValueFilter?: string;
  hasSecondaryFieldValueFilter?: boolean;
  /** پاسخ این پرسش از ذخیره موقت پر شده است
   * در پرسش های ماتریسی اگر پرسش های ماتریس تصادفی بود
   * مواردی که از قبل پاسخ داده شده ابتدای ماتریس نمایش داده شوند
   */
  temporaryAnswerApplied?: boolean;
  override settings: AdditionalSettingRecord | undefined;

  // مقدار قبلی فیلتر لیست اضافه شده SKU dynamic
  previousSecondaryFieldValueFilter? = '';

  /** کلید برای بررسی معتبر بودن کپچا/شماره موبایل/ ایمیل
   * - این کلید در ذخیره داده ها باید به سرور ارسال شود
   */
  validationKey?: string;
  validationGuid?: string;

  questionChilds: QuestionModel[] = [];

  /** ذخیره خودکار پاسخ پرسش با خطا مواجه شده است یا خیر */
  saveSuccess?: boolean | undefined = undefined;
  /** درحال ذخیره پاسخ پرسش */
  loading?: boolean;

  /** زمان پاسخ دهی به این پرسش شروع شده است */
  isStartLimitationAnswer?: boolean;
  /** مدت زمان پاسخ دهی به این پرسش به اتمام رسیده است */
  isEndedLimitationAnswer?: boolean;
  /** زمان باقی مانده برای پاسخ دهی به این پرسش */
  timerCounter?: number;
  /** تایمر */
  timerInterval?: any;
  /** درصد زمان باقی مانده برای پاسخ دهی  */
  timerCounterPrecentage?: number;

  /** ایندکس پرسش ها
   * - start with 0
   */
  rowNumber: number;

  evaluateInitialValue?: string;

  /**
   * uniqueIdPerForm without dash
   * - used in formula
   */
  fid: string;

  constructor(data?: QuestionModel) {
    super();
    if (data) {
      for (let property in data) {
        if (data.hasOwnProperty(property)) {
          (this as any)[property] = (data as any)[property];
        }
      }
    }
    this.answer = '';
    this.questionOptions ??= [];
    this.questionOptions = this.questionOptions.map((m) => new AnswerModel(m));

    this.settings = validationAdditionalSettings(this.questionType, this.settings);
    this.questionOptions.forEach((o) => {
      o.settings = validationAdditionalSettings(this.questionType, o.settings);
    });
    this.questionOptions = new ArraySortPipe().transform(this.questionOptions, 'rowNumber');
    if (this.isRandomizeAnswers) {
      this.questionOptions = new ArrayRandomizePipe().transform(
        this.questionOptions,
        true,
        this.randomizeLastOptionsExclusionCount,
      );
    }

    if ([FormQuestionTypesEnum.PointQuestion].indexOf(this.questionType) > -1) {
      this.minimumAnswer = this.minimumAnswer ? +this.minimumAnswer : 0;
      this.maximumAnswer = this.maximumAnswer ? +this.maximumAnswer : 100;
      this.answer = this.answer ? +this.answer : this.minimumAnswer;
    }

    this.questionChilds ??= [];
    for (let i = 0; i < this.questionChilds.length; i++) {
      this.questionChilds[i] = new QuestionModel(this.questionChilds[i]);
    }
    this.rowNumber ??= 0;
    this.fid = this.uniqueIdPerForm?.replace(/-/g, '');
  }

  // for view matrix on mobile
  isOpen?: boolean;
}
