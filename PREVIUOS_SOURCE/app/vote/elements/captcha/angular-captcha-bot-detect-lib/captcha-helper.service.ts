import { Inject, Injectable, NgZone, DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class CaptchaHelperService {
  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  // get script and execute it immediately
  // getScript(url: string): void {
  //   this.http.get(url, { responseType: 'text' })
  //     .subscribe(
  //       scriptString => {
  //         let f = new Function(scriptString);
  //         this.ngZone.runOutsideAngular(() => {
  //           f();
  //         });
  //       }
  //     );
  // }

  /**
   *  # Content security policy
   *  ## for CSP security checnge above method with this:
   *  */
  getScript(url: string): void {
    const scriptElement = this._document.createElement('script');
    scriptElement.src = url;
    scriptElement.async = true;
    scriptElement.type = 'text/javascript';
    scriptElement.onload = () => {
      console.log(`Script loaded: ${url}`);
    };
    scriptElement.onerror = () => {
      console.error(`Failed to load script: ${url}`);
    };
    this._document.head.appendChild(scriptElement);
  }

  useUserInputBlurValidation(userInput: any): boolean {
    return userInput.getAttribute('correctCaptcha') !== null;
  }

  // get captcha endpoint handler from configued captchaEndpoint value,
  // the result can be "simple-captcha-endpoint.ashx", "simple-captcha-endpoint",
  // or "simple-botdetect.php"
  getCaptchaEndpointHandler(captchaEndpoint: string): string {
    let splited = captchaEndpoint.split('/');
    return splited[splited.length - 1];
  }

  // get backend base url from configued captchaEndpoint value
  getBackendBaseUrl(captchaEndpoint: string, captchaEndpointHandler: string): string {
    let lastIndex = captchaEndpoint.lastIndexOf(captchaEndpointHandler);
    return captchaEndpoint.substring(0, lastIndex);
  }

  // change relative to absolute urls in captcha html markup
  changeRelativeToAbsoluteUrls(originCaptchaHtml: string, captchaEndpoint: string): string {
    let captchaEndpointHandler = this.getCaptchaEndpointHandler(captchaEndpoint);
    let backendUrl = this.getBackendBaseUrl(captchaEndpoint, captchaEndpointHandler);

    originCaptchaHtml = originCaptchaHtml.replace(/<script.*<\/script>/g, '');
    let relativeUrls = originCaptchaHtml.match(/(src|href)=\"([^"]+)\"/g) || '';

    let relativeUrl,
      relativeUrlPrefixPattern,
      absoluteUrl,
      changedCaptchaHtml = originCaptchaHtml;

    for (let i = 0; i < relativeUrls.length; i++) {
      relativeUrl = relativeUrls[i].slice(0, -1).replace(/src=\"|href=\"/, '');
      relativeUrlPrefixPattern = new RegExp('.*' + captchaEndpointHandler);
      absoluteUrl = relativeUrl.replace(relativeUrlPrefixPattern, backendUrl + captchaEndpointHandler);
      changedCaptchaHtml = changedCaptchaHtml.replace(relativeUrl, absoluteUrl);
    }

    return changedCaptchaHtml;
  }
}
