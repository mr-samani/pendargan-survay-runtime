export enum ConditionTypeEnum {
  // انتخاب شده باشد
  Ticked = 1,
  // انتخاب نشده باشد
  NotTicked = 2,
  // همه گزینه های پرسش به جز این گزینه
  AllExceptThis = 3,
  // مقدار عددی بزرگتر از
  GreaterThan = 4,
  // مقدار عددی کوچکتر از
  LessThan = 5,
  // مقدار عددی برابر با
  EqualTo = 6,
  // مقدار متنی برابر با
  TextEqualTo = 7,
  // نتیجه صحیح باشد
  IsTrue = 8,
  // نتیجه صحیح نباشد
  IsFalse = 9,
}
