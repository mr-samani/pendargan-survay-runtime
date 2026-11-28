export function replaceReplaceAllFunction(formula: string, str1: string, str2: string, ignore: boolean) {
  // return formula.replace(
  //   new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, '\\$&'), ignore ? 'gi' : 'g'),
  //   typeof str2 === 'string' ? str2.replace(/\$/g, '$$$$') : str2,
  // );
  const escaped = str1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\s*${escaped}\\s*`, 'g');

  formula = formula.replace(regex, str2);
  return formula;
}

export function sanitizeFormula(oldFormula: string) {
  let formula = oldFormula;

  formula = formula.replace(new RegExp('"', 'g'), "'");

  formula = formula.replace(new RegExp("var (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("for(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("while(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("let (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("function(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  // در فیلتر پاسخ پویا باید بتوان نام ستون را در {{}} گذاشت
  //formula = formula.replace(new RegExp('}(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))', 'g'), ' ');
  //formula = formula.replace(new RegExp('{(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))', 'g'), ' ');
  formula = formula.replace(new RegExp("ajax(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  // formula = formula.replace(new RegExp('[?](?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),' ');
  formula = formula.replace(new RegExp("[;](?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');

  formula = formula.replace(new RegExp("eval(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("window(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("document(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("jQuery(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("\\$(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("alert(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("this(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  formula = formula.replace(new RegExp("console(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ');
  //formula = formula.replace(new RegExp('Math\\.(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),' ');

  formula = formula.replace(new RegExp("\\((?!(([^']*'){2})*[^']*$)", 'g'), ' ');
  formula = formula.replace(new RegExp("\\)(?!(([^']*'){2})*[^']*$)", 'g'), ' ');

  return formula;
}

export function cleanUpFormula(formula: string) {
  formula = sanitizeFormula(formula);

  formula = ' ' + formula + ' ';

  formula = formula.replace(new RegExp("\\)(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ) ');
  formula = formula.replace(new RegExp("\\((?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ( ');

  //to avoid including bitwise symboles (like & or |)
  // formula = formula.replace(new RegExp('(\\W)(?=\\1)',"g"),''); // replace multiple symboles with one
  formula = formula.replace(new RegExp('([=@%#])(?=\\1)', 'g'), '');
  formula = formula.replace(new RegExp(">>>(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' >> ');
  // TODO: now: &&12 => & &12;
  //  formula = formula.replace(new RegExp('([^&*])(&)([^&]*)(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))', "g"), "$1" + " & " + "$3");
  formula = formula.replace(new RegExp("(&&)(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' && ');
  // TODO: now: ||12 => | |12;
  // formula = formula.replace(new RegExp('([^\\|*])(\\|)([^\\|]*)(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))', "g"), "$1" + " | " + "$3");
  formula = formula.replace(new RegExp("([\\|][\\|])(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' || ');

  formula = formula.replace(
    new RegExp("([^>*])(>)([^>]*)(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'),
    '$1' + ' > ' + '$3',
  );
  formula = formula.replace(
    new RegExp("([^<*])(<)([^<]*)(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'),
    '$1' + ' < ' + '$3',
  );
  formula = formula.replace(new RegExp("<<(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' << ');
  formula = formula.replace(new RegExp(">>(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' >> ');

  formula = formula.replace(new RegExp("\\^(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ^ ');
  formula = formula.replace(new RegExp("~(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ~ ');
  formula = formula.replace(new RegExp(":(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' : ');
  formula = formula.replace(new RegExp("\\?(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ? ');

  formula = formula.replace(new RegExp("[\\[](?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' [ ');
  formula = formula.replace(new RegExp("[\\]](?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ] ');

  //formula = formula.replace(new RegExp('([\\[])([^%]*)(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g")," [" + "$2");
  //formula = formula.replace(new RegExp('([^%]*)([\\]])(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),"$1" + "] ");

  formula = formula.replace(new RegExp("=(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' = ');
  formula = formula.replace(new RegExp("%(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' % ');
  formula = formula.replace(new RegExp("!(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' ! ');
  //   formula = formula.replace(new RegExp('@(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),' @');

  formula = formula.replace(new RegExp("\\+(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' + ');
  //// formula = formula.replace(new RegExp('-(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))', "g"), ' - ');
  // formula = formula.replace(new RegExp('[\$](?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),' ');
  //  formula = formula.replace(new RegExp(/[!\[]\$/,"g"),' [%');/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //  formula = formula.replace(new RegExp(/\$[!\]]/,"g"),'%] ');/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  formula = formula.replace(new RegExp("#(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' #');
  // formula = formula.replace(new RegExp(/\[\$/,"g"),' [$');
  //formula = formula.replace(new RegExp(/\$\]/,"g"),'$] ');

  formula = formula.replace(new RegExp("[ ]+(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), '  '); //remove multiple spaces

  //  formula = formula.replace(new RegExp('&(?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),'&&');
  //  formula = formula.replace(new RegExp('[\|](?!(?=[^\']*\'[^\']*(?:\'[^\']*\'[^\']*)*$))',"g"),'||');
  formula = formula.replace(new RegExp(" = (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' == ');
  formula = formula.replace(new RegExp(" <  == (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' <= ');
  formula = formula.replace(new RegExp(" >  == (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' >= ');
  formula = formula.replace(new RegExp(" !  == (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' != ');

  formula = formula.replace(new RegExp(" <  < (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' << ');
  formula = formula.replace(new RegExp(" >  > (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' >> ');
  formula = formula.replace(new RegExp(" \\|  \\| (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' || ');
  formula = formula.replace(new RegExp(" &  & (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' && ');

  formula = formula.replace(new RegExp(" \\[  % (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), ' [%');
  formula = formula.replace(new RegExp(" %  \\] (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), '%] ');

  formula = formula.replace(new RegExp('[ ]+', 'g'), ' '); //remove multiple spaces

  formula = formula.replace(new RegExp("(\\[%\\s*)(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), '[%');
  formula = formula.replace(new RegExp("(\\s*%\\])(?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'g'), '%]');

  // TODO: now:   #Demography.Data.organ   =>   #Demography.Data.or.AN  ;
  // formula = formula.replace(new RegExp('.an ', 'ig'), '.AN ');

  formula = formula.replace(new RegExp("'", 'g'), '"');

  formula = ' ' + formula + ' ';

  return formula;
}

export function checkQuotation(str: any) {
  let count = 0;

  for (let i in str) {
    if (str[i] === '"') {
      count++;
    }
  }

  if (count % 2 !== 0) {
    return false;
  }
  return true;
}

export function checkBrackets(str: any) {
  let depth = 0;

  // tslint:disable-next-line: forin
  for (let i in str) {
    if (str[i] === '(') {
      depth++;
    } else if (str[i] === ')') {
      depth--;
    }
    if (depth < 0) {
      return false;
    }
  }

  if (depth > 0) {
    return false;
  }
  return true;
}

/**
 * جدا کردن متغییر های هر فرمول با استفاده از فاصله
 * @param formula formula
 */
export function splitFormulaBySpace(formula: string): string[] {
  if (!formula) {
    return [];
  }
  const result = formula.split(' ');
  const result2: string[] = [];
  if (!result) {
    return [];
  }
  for (let i = 0; i < result.length; i++) {
    if (result[i].startsWith('@') || result[i].startsWith('#')) {
      result[i] = result[i].substring(1);
    }
    if (result[i].trim() !== '') {
      result2.push(result[i]);
    }
  }
  return result2;
}
