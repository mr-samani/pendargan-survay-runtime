export interface LegacyFormulaFunctionErrorDetails {
  readonly name: string;
  readonly type: 'ExpressionFuncError';
  readonly functionName: string;
  readonly message: string;
}

export class LegacyFormulaFunctionError extends Error {
  readonly type = 'ExpressionFuncError' as const;
  constructor(
    readonly code: string,
    readonly functionName: string,
    message: string,
    name = 'InvalidParameter',
  ) {
    super(message);
    this.name = name;
  }

  toLegacyDetails(): LegacyFormulaFunctionErrorDetails {
    return Object.freeze({
      name: this.name,
      type: this.type,
      functionName: this.functionName,
      message: this.message,
    });
  }
}

export interface LegacyFormulaFunctions {
  readonly random: (max: unknown, key?: unknown) => number;
  readonly endsWith: (a: unknown, b: unknown) => boolean;
  readonly startsWith: (a: unknown, b: unknown) => boolean;
  readonly contains: (a: unknown, b: unknown) => boolean;
  readonly avgWeakData: (neutralNum: number, ...params: number[]) => number;
}

/**
 * Creates a per-evaluator function set. Random values are cached by key for the
 * lifetime of this returned object, matching the old ExpEvaluator instance scope.
 */
export function createLegacyFormulaFunctions(
  randomSource: () => number = Math.random,
): LegacyFormulaFunctions {
  const randomValues = new Map<string, number>();

  const validateStrings = (a: unknown, b: unknown): asserts a is string => {
    if (typeof a !== 'string' || typeof b !== 'string') {
      throw new LegacyFormulaFunctionError(
        'INVALID_STRING_ARGUMENTS',
        'stringFunctions',
        'پارامتر های ورودی باید هر دو متنی باشند',
      );
    }
  };

  const random = (max: unknown, key?: unknown): number => {
    if (key === undefined) {
      throw new LegacyFormulaFunctionError(
        'RANDOM_KEY_REQUIRED',
        'random',
        'متغیر key تابع مشخص نشده است',
        'NoKeyDefined',
      );
    }
    // The legacy implementation used global isNaN and unary plus, so numeric
    // strings, booleans and null follow JavaScript coercion rules.
    if (isNaN(max as number)) {
      throw new LegacyFormulaFunctionError(
        'RANDOM_MAX_NOT_NUMERIC',
        'random',
        'پارامتر اول باید مقداری عددی باشد',
        'NoneNumericParameter',
      );
    }
    const maximum = +(max as number);
    if (maximum < 0) {
      throw new LegacyFormulaFunctionError(
        'RANDOM_MAX_NEGATIVE',
        'random',
        'پارامتر تابع نمی تواند منفی باشد',
        'NegativeParameter',
      );
    }
    const cacheKey = String(key);
    if (!randomValues.has(cacheKey)) {
      randomValues.set(cacheKey, Math.round(randomSource() * maximum));
    }
    return randomValues.get(cacheKey)!;
  };

  const endsWith = (a: unknown, b: unknown): boolean => {
    validateStrings(a, b);
    return (a as string).endsWith(b as string);
  };
  const startsWith = (a: unknown, b: unknown): boolean => {
    validateStrings(a, b);
    return (a as string).startsWith(b as string);
  };
  const contains = (a: unknown, b: unknown): boolean => {
    validateStrings(a, b);
    return (a as string).includes(b as string);
  };

  const avgWeakData = (neutralNum: number, ...params: number[]): number => {
    if (params.length % 2 !== 0) {
      throw new LegacyFormulaFunctionError(
        'AVG_WEAK_DATA_INVALID_PARAMETER_COUNT',
        'avgWeakData',
        'تعداد پارامترهای ورودی باید زوج باشند',
      );
    }
    let weightedSum = 0;
    let totalWeight = 0;
    for (let index = 0; index < params.length; index += 2) {
      const value = params[index];
      const weight = params[index + 1];
      if (value <= neutralNum) continue;
      weightedSum += value * weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) return 0;
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  };

  return Object.freeze({ random, endsWith, startsWith, contains, avgWeakData });
}

/** Operator translation used by the archived mathjs evaluation path. */
export function normalizeLegacyMathJsExpression(expression: string): string {
  return expression
    .replace(/math\./gi, '')
    .replace(/(?<!\!)\!(?!\=)/g, ' not ')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ');
}

/** The old mathjs instance deliberately used JavaScript loose equality. */
export function legacyLooseEqual(left: unknown, right: unknown): boolean {
  // Compatibility is intentional: this mirrors the archived loose-equality override.
  // eslint-disable-next-line eqeqeq
  return left == right;
}
export function legacyLooseNotEqual(left: unknown, right: unknown): boolean {
  return !legacyLooseEqual(left, right);
}
