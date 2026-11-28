import { QuestionModel } from './QuestionModel';

export class SectionSaveModel {
  formSectionUniqueId!: string;
  loopNumber!: number;
  questionList!: QuestionModel[];

  /**
   * اگر کاربر به صفحه بعدی رفت باید این مقدار  پر شود
   *  - فقط اگر کاربر صفحه بعدی زد پر شود
   * - چون ممکن است کاربر دوبارهبه صفحه قبلی برود و شرط تکرار را بردارد بنابراین صفحه خالی ذخیره نشود
   */
  filledData?: boolean;

  /** برای پرسش های داخل retail audit باید مشخص شود این پرسش برای کدام رکورد هست */
  dynamicDataRecordId?: number | string;

  variables!: { [key: string]: string };
}
