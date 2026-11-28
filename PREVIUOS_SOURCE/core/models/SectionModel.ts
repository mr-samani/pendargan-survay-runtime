import { GetFormSectionDto } from './backend-dto/GetFormSectionDto';

/**
 * ## نکته مهم
 * - آخرین پرسش بخش فرزند ماتریس ها نیست
 */

export class SectionModel extends GetFormSectionDto {
  dontShow?: boolean;
  // پرسش شروع بخش
  startFormQuestionUniqueId!: string;
  // آخرین پرسش این بخش
  endFormQuestionUniqueId!: string;

  // اولویت پرسش اول
  sartQuestionPriority!: number;
  // اولویت پرسش آخر
  endQuestionPriority!: number;

  // آیا این بخش باید تکرار شود؟
  hasLoop?: boolean;

  /**
   * شماره فعلی حلقه
   *-  در سمت فرانت سکنشن هابا 0 شروع میشوند ولی در بک اند با 1 شروع می شوند
   *
   */
  // loopNumber!: number;

  // آیا سکشن پرسش قابل نمایش دارد
  hasVisibleQuestion!: boolean;
}
