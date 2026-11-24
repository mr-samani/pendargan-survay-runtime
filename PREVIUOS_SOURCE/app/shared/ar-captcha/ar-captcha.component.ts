
import { AfterViewInit, Component, Inject, DOCUMENT } from '@angular/core';
import { AppConsts } from '@core/app-consts';
declare var arcaptcha: any;
@Component({
  standalone: false,
  selector: 'ar-captcha',
  template: '<div class="arcaptcha"></div>',
  // template: '<div class="arcaptcha"  [attr.data-site-key]="siteKey">arcaptcha</div>',
})
export class ArCaptchaComponent implements AfterViewInit {
  isFound = false;
  siteKey = AppConsts.arCaptchaSiteKey;
  constructor(@Inject(DOCUMENT) private _document: Document) {
    this.loadScript();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.isFound) {
        this.renderCaptcha();
      }
    }, 500);
  }

  renderCaptcha(): void {
    const el = this._document.querySelector('.arcaptcha');
    arcaptcha.render(el, {
      'site-key': this.siteKey,
      'data-size': 'invisible',
    });
  }

  public loadScript(): void {
    const scripts = this._document.getElementsByTagName('script');
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < scripts.length; ++i) {
      if (scripts[i].getAttribute('src') != null && scripts[i].getAttribute('src')?.includes('arcaptcha')) {
        this.isFound = true;
      }
    }

    if (!this.isFound) {
      const dynamicScripts = ['https://widget.arcaptcha.ir/1/api.js'];
      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < dynamicScripts.length; i++) {
        const node = this._document.createElement('script');
        node.src = dynamicScripts[i];
        node.type = 'text/javascript';
        node.async = true;
        node.defer = true;
        this._document.getElementsByTagName('head')[0].appendChild(node);
        node.onload = () => {
          this.renderCaptcha();
        };
      }
    }
  }
}
