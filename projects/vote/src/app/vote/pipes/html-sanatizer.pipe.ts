import { Pipe, PipeTransform, Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import sanitizeHtml from 'sanitize-html';
import { AppConsts } from '../../../core/models/app-consts';

@Pipe({
  name: 'safeHtml',
})
export class HtmlSanatizePipe implements PipeTransform {
  constructor(private sanatizer: DomSanitizer) {}

  transform(val?: string | null): SafeHtml | null {
    if (val) {
      // replace file address variable to  absolute address
      val = val.replace(new RegExp(AppConsts.fileServerVariableName, 'g'), AppConsts.fileServerUrl);

      const cleaned = sanitizeHtml(val.toString(), {
        allowedTags: [
          'div',
          'p',
          'b',
          'video',
          'audio',
          'source',
          'a',
          'span',
          'strong',
          'small',
          'em',
          's',
          'img',
          'table',
          'thead',
          'tbody',
          'tfooter',
          'tr',
          'th',
          'td',
          'colgroup',
          'col',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ol',
          'ul',
          'li',
          'br',
          'hr',
        ],
        allowedAttributes: {
          '*': ['style', 'class'],
          a: ['href', 'target', 'style', 'class'],
          img: ['src', 'width', 'height', 'style', 'class'],
          source: ['src'],
          video: ['controls', 'style', 'class'],
          audio: ['controls', 'style', 'class'],
          th: ['rowspan', 'colspan', 'style', 'class'],
          td: ['rowspan', 'colspan', 'style', 'class'],
        },
        allowedSchemesByTag: { img: ['data', 'http', 'https'] },
      });
      return this.sanatizer.bypassSecurityTrustHtml(cleaned);
    } else {
      return null;
    }
  }
}
