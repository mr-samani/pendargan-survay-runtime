import { Pipe, PipeTransform } from '@angular/core';
import { humanFileSize } from '../helper/file.helper';

@Pipe({
  standalone: false,
  name: 'humanizeFileSize',
})
export class HumanizeFileSizePipe implements PipeTransform {
  transform(value: any): string {
    if (value == '' || value == undefined) {
      return '';
    }
    return humanFileSize(value);
  }
}
