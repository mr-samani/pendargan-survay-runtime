import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { QuestionChartSetting } from '../elements/chart/chart-question.model';
import { FileSelectionTypeEnum } from '../elements/file-upload-pwa/file-upload-pwa.model';
import { RatingQuestionTypeEnum } from '../elements/rating/rating-question-type.enum';
import { DateTime } from 'luxon';
import { UtcDateTimeHelper } from '@core/helper/utc-datetime.helper';

function isTrue(val: any) {
  return val === 'true' || val === true;
}
function isNumber(val: any, defaultValue: number) {
  if (val !== undefined && Number.isInteger(+val) && !Number.isNaN(+val)) return +val;
  else return defaultValue;
}
function tryGetMatrixConfig(val: any): MatrixConfig {
  const defaultConfig: MatrixConfig = { columnSize: {}, simpleMode: false, responsiveInMobile: true };
  try {
    let config = typeof val === 'object' ? val : typeof val === 'string' ? JSON.parse(val) : {};
    return { ...defaultConfig, ...config };
  } catch (error) {
    return defaultConfig;
  }
}
function tryGetChartConfig(val: any): QuestionChartSetting[] {
  try {
    if (!val) {
      return [];
    } else {
      return typeof val === 'object' ? val : typeof val === 'string' ? JSON.parse(val) : [];
    }
  } catch (error) {
    return [];
  }
}

function checkDateTime(val?: string | DateTime): DateTime | undefined {
  if (!val) return undefined;
  try {
    if (typeof val == 'string') {
      val = DateTime.fromISO(val);
    }
    return UtcDateTimeHelper.convertUtcToLocalDateTime(val).localDateTime;
  } catch (error) {
    console.warn('error on convert date:', error);
    return undefined;
  }
}

export function validationAdditionalSettings(
  type: FormQuestionTypesEnum,
  setting: AdditionalSettingRecord | undefined,
): AdditionalSettingRecord {
  //  console.log('before', setting);
  if (!setting) {
    setting = {};
  }

  // public setting
  if (type != FormQuestionTypesEnum.HtmlFrame && type != FormQuestionTypesEnum.Group) {
    setting.dontShowQuestionTitle = isTrue(setting.dontShowQuestionTitle);
    setting.hasTimer = isTrue(setting.hasTimer);
    setting.timerQuestionSeconds = isNumber(setting.timerQuestionSeconds, 0);
  }
  switch (type) {
    case FormQuestionTypesEnum.Numeric:
      setting.thousandsSeparator = isTrue(setting.thousandsSeparator);
      setting.isDecimal = isTrue(setting.isDecimal);
      break;
    case FormQuestionTypesEnum.Point_NumericScale:
    case FormQuestionTypesEnum.NPS:
      setting.useGradientScaleColor = isTrue(setting.useGradientScaleColor);
      setting.showNoCommentOption = isTrue(setting.showNoCommentOption);
      setting.noCommentOptionText = setting.noCommentOptionText ?? '';
      setting.noComment = isTrue(setting.noComment);
      break;
    case FormQuestionTypesEnum.DynamicAnswer:
      setting.checkDuplicateOptionInSectionLoop = isTrue(setting.checkDuplicateOptionInSectionLoop);
      setting.autoSelectFirstOption = isTrue(setting.autoSelectFirstOption);
      setting.dontShowAutoComplete = isTrue(setting.dontShowAutoComplete);
      break;
    case FormQuestionTypesEnum.FileUpload:
      if (setting.fileSelectionType) {
        setting.fileSelectionType = +setting.fileSelectionType;
      }
      break;
    case FormQuestionTypesEnum.Rating:
      if (!setting.ratingQuestionType) {
        setting.ratingQuestionType = RatingQuestionTypeEnum.Star;
      }
      setting.ratingQuestionType = +setting.ratingQuestionType;
      break;
    case FormQuestionTypesEnum.SkuCount:
    case FormQuestionTypesEnum.SkuCount_Dynamic:
      setting.skuAdvanceButtons = isTrue(setting.skuAdvanceButtons);
      break;
    case FormQuestionTypesEnum.RecordsOtherForms:
      setting.selectLastOptionWhenResultIsMoreThanOnce = isTrue(setting.selectLastOptionWhenResultIsMoreThanOnce);
      break;
    case FormQuestionTypesEnum.Chart:
      setting.chartSetting = tryGetChartConfig(setting.chartSetting);
      break;
    case FormQuestionTypesEnum.Email:
      setting.expireMinuteOfValidation = isNumber(setting.expireMinuteOfValidation, 2);
      setting.codeLengthOfValidation = isNumber(setting.codeLengthOfValidation, 4);
      break;
    case FormQuestionTypesEnum.Mobile:
      setting.expireMinuteOfValidation = isNumber(setting.expireMinuteOfValidation, 2);
      setting.codeLengthOfValidation = isNumber(setting.codeLengthOfValidation, 4);
      break;
    case FormQuestionTypesEnum.Payment:
      setting.amount = isNumber(setting.amount, 1000);
      break;
    case FormQuestionTypesEnum.Matrix_Dynamic:
    case FormQuestionTypesEnum.Matrix:
      setting.matrixConfig = tryGetMatrixConfig(setting.matrixConfig);
      break;
    case FormQuestionTypesEnum.RetailAudit:
      setting.canSelectDuplicateItems = isTrue(setting.canSelectDuplicateItems);
      setting.mandatoryCompletionAllRecords = isTrue(setting.mandatoryCompletionAllRecords);
      break;
    case FormQuestionTypesEnum.Date:
      setting.minDate = checkDateTime(setting.minDate);
      setting.maxDate = checkDateTime(setting.maxDate);
      break;
    case FormQuestionTypesEnum.HtmlFrame:
      setting.stickyPosition = isTrue(setting.stickyPosition);
      break;
  }
  // console.log('after', setting);
  return setting;
}

export type AdditionalSettingRecord = {
  /** آدرس تصویر برای پرسش های تصویری یا ایموجی */
  imageUrl?: string;
  /** استفاده از طیف رنگ برای پرسش های طیفی */
  useGradientScaleColor?: boolean;
  /** نمایش گزینه نظری ندارم/نمیدانم برای پرسش های طیفی */
  showNoCommentOption?: boolean;
  /** عنوان گزینه نظری ندارم/نمیدانم برای پرسش های طیفی */
  noCommentOptionText?: string;
  noComment?: boolean;
  /** جدا کننده سه رقمی برای پرسش های عددی */
  thousandsSeparator?: boolean;
  /** حداکثر تعداد رقم اعشار برای پرسش های عددی اعشاری */
  maxDecimalDigit?: number;
  /** استفاده از اعشار در پرسش های عددی */
  isDecimal?: boolean;
  /** بررسی عدم انتخاب پاسخ پویا تکراری در تکرار حلقه ها */
  checkDuplicateOptionInSectionLoop?: boolean;
  /** پیشفرض اولین گزینه قابل انتخاب در پاسخ پویا انتخاب شود */
  autoSelectFirstOption?: boolean;
  /** عدم نمایش دراپ دان در پاسخ پویا زمانی که اولین گزینه خودکار انتخاب می شود */
  dontShowAutoComplete?: boolean;
  /** انواع قابلیت انتخاب فایل: عکس گرفتن، ضبط صدا، ضبط فیلم و غیره */
  fileSelectionType?: FileSelectionTypeEnum;
  /** نوع پرسش امتیازی: ستاره ای، لایک، قلب، نواری */
  ratingQuestionType?: RatingQuestionTypeEnum;
  /** فیلد های قابل نمایش در نمودار */
  chartSetting?: string | QuestionChartSetting[];
  /** عنوان ستون بانک داده برای مجور x ها */
  chartCategoryColumn?: string;
  /** نمایش دکمه + و - و تاریخچه در پرسش های شمارش موجودی */
  skuAdvanceButtons?: boolean;
  /** انتخاب اخرین سطر در صورتی که نتیج بیش از یک سطر بود در پرسش سوابق دموگرافی از دیگر فرمها */
  selectLastOptionWhenResultIsMoreThanOnce?: boolean;

  /** آیدی سکشن برای نمایش در دیالوگ */
  formSectionUniqueId?: string;

  /** عدم نمایش عنوان پرسش - به جز پرسش html */
  dontShowQuestionTitle?: boolean;

  /** مدت زمان اعتبار کد تائید - برای پرسش های موبایل و ایمیل */
  expireMinuteOfValidation?: number;
  /** طول کد تائید - برای پرسش های موبایل و ایمیل */
  codeLengthOfValidation?: number;

  /** مبلغ قابل پرداخت در پرسش پرداخت آنلاین */
  amount?: number;

  matrixConfig?: MatrixConfig;

  /** پاسخ دهی به این پرسش دارای محدودیت زماتی می باشد؟ */
  hasTimer?: boolean;
  /** مدت زمان محدودیت پاسخ دهی به این پرسش */
  timerQuestionSeconds?: number;
  /** امکان انتخاب گزینه تکراری در پرسش Retail audit */
  canSelectDuplicateItems?: boolean;
  /** اجباری بودن تکمیل همه رکورد ها برای پرسش retail audit */
  mandatoryCompletionAllRecords?: boolean;

  /** بازه شروع و پایان برای پرسش تاریخ */
  minDate?: DateTime;
  maxDate?: DateTime;

  /**چسباندن پرسش به بالا یا پایین صفحه، هنگام اسکرول کردن */
  stickyPosition?: boolean;

  /** پسوند برای ظرفیت باقی مانده */
  clusterRemaingCountPrefix?: string;

  /** input mask key  */
  maskKey?: string;
  /** input mask regular expression  */
  maskRegEx?: string;
};

export type MatrixConfig = {
  columnSize: { [ColumnIndex: number]: number };
  /** نمایش عادی یا نمایش مانند اکسل ساده
   * - فقط برای ماتریس پویا
   */
  simpleMode: boolean;
  /** show matrix as accordion menu in mobile */
  responsiveInMobile: boolean;
};
