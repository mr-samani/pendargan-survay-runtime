import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'striphtml',
})
export class StripHtmlPipe implements PipeTransform {
  transform(value?: string): any {
    // return value.replace(/<.*?>/g, ''); // replace tags
    if (!value) {
      return '';
    }
    return this.stripHtml(value.toString());
  }

  stripHtml(html: string) {
    // ----- remove HTML TAGs -----
    let $string = html.replace(/<[^>]*>/g, ' ');

    // ----- remove control characters -----
    $string = $string.replace('\r', ''); // --- replace with empty space
    $string = $string.replace('\n', ' '); // --- replace with space
    $string = $string.replace('\t', ' '); // --- replace with space
    $string = this.fromHtmlEntities($string);
    $string = $string.replace(/&nbsp;|&zwnj;|&raquo;|&laquo;|&gt;/g, ' ');
    // ----- remove multiple spaces -----
    $string = $string.replace('/ {2,}/', ' ').trim();

    return $string;
  }

  fromHtmlEntities(string: string) {
    return (string + '').replace(/&#\d+;/gm, (s) => {
      const mached: string[] | null = s.match(/\d+/gm);
      return mached && mached.length > 0 ? String.fromCharCode(+mached[0]) : '';
    });
  }

  toHtmlEntities(string: string) {
    return string.replace(/./gm, function (s) {
      return '&#' + s.charCodeAt(0) + ';';
    });
  }
}
