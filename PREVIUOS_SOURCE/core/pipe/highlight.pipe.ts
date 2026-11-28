// highlight.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'highlight',
})
export class HighlightPipe implements PipeTransform {
  transform(text: string, search: string): any {
    if (!search || !text) return text;
    const pattern = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); // escape regex
    const regex = new RegExp(`(${pattern})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}
