import { AppConsts } from '@core/app-consts';
import { evaluateDependencies, create, factory, all, MathJsInstance } from 'mathjs';
// https://mathjs.org/docs/expressions/syntax.html

export class ExpEvaluator {
  // result of function random(max,key);
  private randomValues: any[] = [];
  math: MathJsInstance;
  customFunctions = {
    random: this.random.bind(this),
    endsWith: this.endsWith.bind(this),
    startsWith: this.startsWith.bind(this),
    contains: this.contains.bind(this),
    avgWeakData: this.avgWeakData.bind(this),
  };
  constructor() {
    this.math = create({
      all,
      createRandom: factory('random', [], () => this.random.bind(this)),
      endsWith: factory('endsWith', [], () => this.endsWith.bind(this)),
      startsWith: factory('startsWith', [], () => this.startsWith.bind(this)),
      contains: factory('contains', [], () => this.contains.bind(this)),
      avgWeakData: factory('avgWeakData', [], () => this.avgWeakData.bind(this)),
    });
    // در حال حاضر اگر شرط به این صورت باشد
    // " "m" == "1" "
    // خطا می دهد که m را نمی تواند به number تبدیل کند
    // به همین دلیل باید رفتار پیش فرض mathjs  را اصلاح کرد
    this.math.import(
      {
        equal: (a: any, b: any) => a == b,
        unequal: (a: any, b: any) => a != b,
      },
      { override: true },
    );
  }

  public evaluate(expression: string) {
    // commented because CSP unsafe-eval (content security policy)
    if (!AppConsts.expressionCaseSensitive) {
      const scope = {
        ...this.customFunctions,
        Math,
        Date,
      };
      const fn = new Function(...Object.keys(scope), `return (${expression});`);
      const result = fn(...Object.values(scope));
      return result;
    }

    expression = expression.replace(/math./gi, '');
    expression = expression.replace(/(?<!\!)\!(?!\=)/g, ' not ');
    expression = expression.replace(/&&/g, ' and ');
    expression = expression.replace(/\|\|/g, ' or ');
    const r = this.math.evaluate(expression);
    return r;
  }

  /*---------------- custom functions -------------------*/

  validateABIsString(a: string, b: string) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      throw {
        name: 'InvalidParameter',
        type: 'ExpressionFuncError',
        functionName: 'stringFunctions',
        message: 'پارامتر های ورودی باید هر دو متنی باشند',
      };
    }
  }
  endsWith(a: string, b: string): boolean {
    this.validateABIsString(a, b);
    return a.endsWith(b);
  }
  startsWith(a: string, b: string): boolean {
    this.validateABIsString(a, b);
    return a.startsWith(b);
  }
  contains(a: string, b: string): boolean {
    this.validateABIsString(a, b);
    return a.includes(b);
  }
  random(max: number, key: any): any {
    if (key === undefined) {
      throw {
        name: 'NoKeyDefined',
        type: 'ExpressionFuncError',
        // tslint:disable-next-line: no-arg
        functionName: 'random',
        message: 'متغیر key تابع مشخص نشده است',
      };
    }
    if (isNaN(max)) {
      throw {
        name: 'NoneNumericParameter',
        type: 'ExpressionFuncError',
        // tslint:disable-next-line: no-arg
        functionName: 'random',
        message: 'پارامتر اول باید مقداری عددی باشد',
      };
    }
    if (max < 0) {
      throw {
        name: 'NegativeParameter',
        type: 'ExpressionFuncError',
        // tslint:disable-next-line: no-arg
        functionName: 'random',
        message: 'پارامتر تابع نمی تواند منفی باشد',
      };
    }
    if (this.randomValues[key] === undefined) {
      const min = 0;
      const steps = +max - min;
      const rand = Math.round(min + Math.random() * steps);
      this.randomValues[key] = rand;
    }
    return this.randomValues[key];
  }
  /**
   *  محاسبه میانگین وزنی برای کانون ارزیابی
   *  @params neutralNum عدد خنثی که نباید در میانگین تاثیر بگذارد
   *  @params arguments آیتم ها که با کاما از هم جدا می شوند
   *  @return میانگین وزنی مقدار هایی که بزرگتر از پارامتر اول هستند
   *  ## مثال:
   *  -   avgWeakData ( 1, #Q1-1.Number , #Q1-2.Point , #Q1-3.Number , #Q1-4.Point )
   *  -   avgWeakData (1 , value , weigth , value , weigth)
   *  -   avgWeakData (1 , 2 , 1 , 6 , 2) => 4.67
   *  -
   */
  avgWeakData(neutralNum: number, ...params: number[]): number {
    // The number of parameters must be even
    if (params.length % 2 !== 0) {
      throw {
        name: 'InvalidParameter',
        type: 'ExpressionFuncError',
        functionName: 'avgWeakData',
        message: 'تعداد پارامترهای ورودی باید زوج باشند',
      };
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < params.length; i += 2) {
      const value = params[i];
      const weight = params[i + 1];

      if (value <= neutralNum) {
        continue;
      }

      weightedSum += value * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }
}
