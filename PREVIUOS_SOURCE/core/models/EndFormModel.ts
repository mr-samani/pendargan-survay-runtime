export interface EndFormModel {
  // پرسشی که باعث شده پایان فرم رخ دهد
  byQuestionId: number;
  // پرسشی که پایان فرم است
  endQuestionId: number;
  // نوع پایان فرم
  // endSection;endForm;endFormSubmit
  endFormType: number;
}
