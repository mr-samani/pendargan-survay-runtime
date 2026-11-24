import { convertToLowerCaseData } from './convert-to-lower-case';

export function readJsonFile(ev: any) {
  return new Promise(async (resolve, reject) => {
    const file = ev.currentTarget.files?.[0];
    if (!file) {
      resolve({});
      return;
    }

    try {
      // خواندن فایل متنی/JSON
      const content = await file.text();
      const data = convertToLowerCaseData(content);
      resolve(JSON.parse(data));
    } catch (error) {
      alert(error);
      reject(error);
    }
  });
}
