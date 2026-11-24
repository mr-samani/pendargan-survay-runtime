import { Pipe, PipeTransform, Injectable } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'secendToTime',
})
@Injectable()
export class SecendToTimePipe implements PipeTransform {
  transform(val: any): string {
    if (val) {
      var dateObj = new Date(+val * 1000);
      var hours = dateObj.getUTCHours();
      var minutes = dateObj.getUTCMinutes();
      var seconds = dateObj.getSeconds();

      var timeString =
        hours.toString().padStart(2, '0') +
        ':' +
        minutes.toString().padStart(2, '0') +
        ':' +
        seconds.toString().padStart(2, '0');

      return timeString;
    } else {
      return '';
    }
  }
}
