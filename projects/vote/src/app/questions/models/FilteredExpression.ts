import { ExpressionActionsEnum } from '@service-proxies/models';


export class FilteredExpression {
  [key: number]: string[];
  constructor() {
    Object.values(ExpressionActionsEnum)
      .filter((x) => Number.isInteger(x))
      .forEach((e) => (this[+e] = []));
  }
}
