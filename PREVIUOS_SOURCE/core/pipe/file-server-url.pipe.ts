import { Pipe, PipeTransform } from '@angular/core';
import { AppConsts } from '@core/app-consts';

@Pipe({
  standalone: false,
  name: 'fileServerUrl',
})
export class FileServerUrlPipe implements PipeTransform {
  transform(value?: string): string {
    if (typeof value == 'string') {
      value = value.replace(new RegExp(AppConsts.fileServerVariableName, 'g'), AppConsts.fileServerUrl);
      value = value.replace(new RegExp(AppConsts.pollThemeBaseUrlVariableName, 'g'), AppConsts.pollThemeBaseUrl);
    }
    return value ?? '';
  }
}

