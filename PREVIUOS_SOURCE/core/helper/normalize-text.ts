/**
 * replace persian/arabic numbers to latin number
 *
 * replace یي/کك  to ک/ی
 * @param text input text
 * @returns replaced caratchers
 */
export const normalizeText = (text: string) => {
  if (!text) return text;
  return text
    .normalize('NFKC')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[یي]/g, 'ی') // تبدیل همه‌ی انواع "ی" به یک شکل
    .replace(/[کك]/g, 'ک'); // تبدیل همه‌ی انواع "ک" به یک شکل
};
