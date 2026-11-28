export class DynamicDataResult {
  identificationCode!: number | string;
  answerTitle!: string | undefined;
  isSelectedInSectionLoop?: boolean;
  jsonValuesDictionary!: { [key: string]: string } | undefined;

  /** used in SkuCount_Dynamic */
  total?: number;
}
