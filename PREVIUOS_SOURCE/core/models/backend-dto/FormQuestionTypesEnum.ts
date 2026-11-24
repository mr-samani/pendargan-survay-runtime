export enum FormQuestionTypesEnum {
  /** تک انتخابی */
  UniqueSelect = 1,
  /** چند انتخابی */
  MultiSelect = 2,
  /** لیست کشویی */
  Dropdown = 3,
  /** متن کوتاه */
  ShortText = 4,
  /** متن بلند */
  LongText = 5,
  /** عددی */
  Numeric = 6,
  /** انتخاب تاریخ */
  Date = 7,
  /** ایمیل */
  Email = 8,
  /** انتخاب ساعت */
  Time = 9,
  /** تلفن ثابت */
  Phone = 10,
  /** شماره موبایل */
  Mobile = 11,
  /** کد ملی */
  NationalCode = 12,
  /** اولویت دار */
  HasPriority = 13,

  /** پرسش اصلیه ماتریس معمولی */
  Matrix = 14,
  /** پرسش اصلی ماتریس پویا */
  Matrix_Dynamic = 30,
  /** ماتریس تک انتخابی */
  Matrix_radio = 15,
  /** ماتریس چندانتخابی */
  Matrix_checkbox = 16,
  /** ماتریس عددی
   * @deprecated با اضافه شدن ماتریس پویا این نوع حذف شد
   */
  Matrix_MultiNumeric = 25,
  /** ماتریس متنی
   * @deprecated با اضافه شدن ماتریس پویا این نوع حذف شد
   */
  Matrix_MultiShortText = 26,
  /** امتیازی */
  PointQuestion = 17,
  /** پاسخ پویا */
  DynamicAnswer = 18,
  /** آپلود فایل */
  FileUpload = 19,
  /** محتوای html */
  HtmlFrame = 20,
  /** شمارش موجودی معمولی */
  SkuCount = 22,
  /** تک انتخابی تصویری */
  UniqueSelectWithImageOptions = 27,
  /** چندانتخابی تصویری */
  MultiSelectWithImageOptions = 28,
  /** پرسش متنی سفارشی با رج‌ایکس */
  CustomMaskShortText = 29,
  /** شمارش موجودی پویا */
  SkuCount_Dynamic = 31,
  /** طیفی */
  Point_NumericScale = 32,
  /** شاخص خالص ترویج */
  NPS = 33,
  /** ایموجی */
  Emoji = 34,
  /** رتبه بندی */
  Rating = 35,
  /** نموداری */
  Chart = 36,
  /** پرسش retail audit */
  RetailAudit = 37,
  /** نتیجه در دیگر فرم ها */
  RecordsOtherForms = 38,
  /** باز کردن سکشن به صورت popup */
  OpenPopUpSection = 39,
  /** پرسش تصویر امنیتی کیچا */
  Captcha = 40,
  /** انتخاب موقعیت مکانی */
  Location = 41,
  /** ضبط صدا */
  VoiceRecord = 42,
  /** پرداخت آنلاین */
  Payment = 43,
  /** گروه پرسش */
  Group = 44,
  /** کد پستی */
  PostalCode = 45,
}
