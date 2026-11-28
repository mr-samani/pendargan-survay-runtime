import { Direction } from '@angular/cdk/bidi';

import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  direction: Direction = 'rtl';
  languageName = 'fa';
  rtlLang = ['fa', 'fa-ir', 'ar'];
  availableLangs = ['en', 'fa', 'ar'];
  isRtl!: boolean;
  /**
   *
   */
  constructor(
    private translateService: TranslateService,
    @Inject(DOCUMENT) private _document: Document,
    private dateAdapter: DateAdapter<Date>,
  ) {}
  /**
   * تنظیم زبان
   * @param lang زبان
   */
  async setPageLanguageAndDirection(lang?: string | null): Promise<void> {
    if (!lang || lang.toLowerCase() === 'fa-ir' || this.availableLangs.indexOf(lang) === -1) {
      lang = 'fa';
    }
    this.isRtl = this.rtlLang.indexOf(lang.toLowerCase()) > -1;
    this.languageName = lang;
    this.direction = this.isRtl ? 'rtl' : 'ltr';
    this.translateService.addLangs(this.availableLangs);
    await this.translateService.use(this.languageName).subscribe();
    this.translateService.setFallbackLang(this.languageName);
    this._document.body.setAttribute('dir', this.direction);
    this._document.documentElement.lang = this.languageName === 'fa' ? 'fa-IR' : this.languageName;
    //DON`T SET HTML TAG TO RTL
    // this._document.documentElement.dir = this.direction;
    this.dateAdapter.setLocale(this.languageName);
  }
}
