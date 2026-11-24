import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { PollTheme } from '@app/vote/helpers/poll-theme';
import { GetPollGuidByTokenOutputDto } from '@core/models/backend-dto/GetPollGuidByTokenOutputDto';
import { PollThemeVersionChecker } from '../helpers/theme-version';
import { LanguageService } from '../../../core/services/language.service';
import { alpha } from '@core/helper/color/color-alpha';

import { StripHtmlPipe } from '@core/pipe/strip-html.pipe';

@Injectable()
export class VoteThemeService {
  theme = new PollTheme();

  logoId = '';
  companyTitle = '';

  constructor(
    private languageService: LanguageService,
    private _title: Title,
    private _meta: Meta,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  updateTheme(pollTheme: string, pollSetting: GetPollGuidByTokenOutputDto) {
    if (pollSetting) {
      this.setMetaConfig(pollSetting);
    }
    if (pollTheme) {
      this.inittializeTheme(pollTheme);
    }
  }
  inittializeTheme(jsonString?: string): void {
    // console.time('initialize theme');
    this.theme = PollThemeVersionChecker.checkTheme(jsonString);

    let questionCss = this.convertJsonToCss(this.theme.question);
    let pollTitleCss = this.convertJsonToCss(this.theme.pollTitle);
    let answerCss = this.convertJsonToCss(this.theme.answer);
    let nextButtonCss = this.convertJsonToCss(this.theme.nextButton);
    let previousButtonCss = this.convertJsonToCss(this.theme.previousButton);
    let customStyle = '';
    if (!this.theme.header.backgroundImage && !this.theme.header.backgroundColor) {
      this.theme.header.backgroundImage = 'assets/images/bg-header.jpg';
    }

    // variable
    customStyle += `:root{
            --mainFgColor: ${this.theme.main.color};
            --mainBgColor: ${this.theme.main.backgroundColor};
            --mainFontSize: ${this.theme.main.fontSize};
            --questionColor:${this.theme.question.color};
            --questionFontSize:${this.theme.question.fontSize};
            --answerColor:${this.theme.answer.color};
            --answerFontSize:${this.theme.answer.fontSize};
            --answerFontFamily:${this.theme.answer.fontFamily};

            --mat-theme-text-primary-on-background:${this.theme.answer.color};
            --mat-theme-secondary:${this.theme.question.color};
 
            --checkbox-box-color: ${this.theme.answer.color}; 
            --checkbox-check-color: ${this.theme.answer.color}; 

            --radio-check-color: ${this.theme.answer.color};
            --radio-box-color:  ${this.theme.answer.color};

            --progress-value-color:${this.theme.progressBar.color}; 
            --progress-back-color :${this.theme.progressBar.backgroundColor};
            --mat-progress-spinner-active-indicator-color:${this.theme.progressBar.color};

            --textVariable:${this.theme.main.variableColor};
            --alertTextColor:${this.theme.main.alertColor};
            --hintTextColor:${this.theme.main.hintColor};
            --alertTextColorOpacity:${alpha(this.theme.main.alertColor, 0.1)};
            --mat-theme-error:${this.theme.main.alertColor};
            --selectedItemColor:${alpha(this.theme.answer.color, 0.2)};


            --tableBackground:${this.theme.table.backgroundColor};
            --tableTextColor:${this.theme.table.color};

            --mat-option-label-text-color:${this.theme.answer.color};
            --mat-list-list-item-hover-label-text-color:${this.theme.answer.color};
            --mat-list-list-item-label-text-color:${this.theme.answer.color};
            --mat-list-list-item-hover-label-text-color:${this.theme.answer.color};
            --mat-list-list-item-focus-label-text-color:${this.theme.answer.color};

        }
        .mat-mdc-list-option{
            --mat-checkbox-selected-icon-color:${this.theme.answer.color} !important;
            --mat-checkbox-unselected-icon-color:${this.theme.answer.color} !important;
        }
        .mat-mdc-tab-group, .mat-mdc-tab-nav-bar{
            --mat-tab-inactive-label-text-color:${alpha(this.theme.answer.color, 0.5)};
            --mat-tab-active-hover-label-text-color:${this.theme.answer.color};
            --mat-tab-active-focus-label-text-color:${this.theme.answer.color};
            --mat-tab-inactive-hover-label-text-color:${alpha(this.theme.answer.color, 0.8)};
            --mat-tab-active-label-text-color:${this.theme.answer.color};
            --mat-tab-active-indicator-color:${this.theme.answer.color};
            --mat-tab-active-hover-indicator-color:${this.theme.answer.color};
            --mat-tab-active-focus-indicator-color:${this.theme.answer.color};
        }
        `;

    customStyle +=
      'body{background-color:' + this.theme.main.backgroundColor + ' !important;color:' + this.theme.main.color + '}';
    // dialog
    customStyle +=
      '.poll-info,.poll-info-dialog,.mat-mdc-dialog-container,.record-permission-info,.wait-for-save,.upload-recording-file{background-color:' +
      this.theme.main.backgroundColor +
      ' !important;color:' +
      this.theme.main.color +
      '}';
    customStyle += `.mat-mdc-dialog-container .mdc-dialog__surface{
            --mat-dialog-container-color: ${this.theme.main.backgroundColor};
            color: ${this.theme.main.color}
        }`;
    // alert
    customStyle +=
      '.ngx-alert-inner{background-color:' +
      this.theme.main.backgroundColor +
      ' !important;color:' +
      this.theme.main.color +
      '}';

    customStyle += `
      .fixed-bottom-button{ 
        color: ${this.theme.footer.color} !important; 
        background-color: ${this.theme.footer.backgroundColor} !important;
      }
      .progress-bar-question{
        background-color:${this.theme.footer.backgroundColor} !important;
      }`;

    customStyle += '.fixed-bottom-actions{ background-color:' + this.theme.main.backgroundColor + ' !important;}';

    customStyle += '.sku-header{ background-color:' + this.theme.main.backgroundColor + ' !important;}';
    if (this.theme.main.backgroundImage) {
      customStyle += `.bg-cover{opacity:${this.theme.main.opacity};
                                      background-image:url(${this.theme.main.backgroundImage});
                                      background-position:${this.theme.main.backgroundPosition};
                                      background-size:${this.theme.main.backgroundSize};
                                      background-repeat:${this.theme.main.backgroundRepeat ? 'repeat' : 'no-repeat'};
            }`;
    }
    // if (this.theme.main.fontSize > -1) {
    //     customStyle += '.bg-cover img{width:' + this.theme.main.size + '% ;}';
    // } else {
    //     customStyle += '.bg-cover img{width:auto;}';
    // }

    //pollTitle
    customStyle += '.poll-title{' + pollTitleCss + '}';

    customStyle += '.questions .question.demographic{' + questionCss + '}';

    customStyle += '.questions .question .title{' + questionCss + '}';
    // customStyle += '.questions .question .matrix-question-title{' + questionCss + '}';
    customStyle += '.matrix  .description-in-mobile{' + questionCss + '}';

    customStyle += '.answer-title{' + answerCss + '}';

    customStyle += '.emoji-title{' + answerCss + '}';
    // material class
    customStyle += '.mdc-form-field{' + answerCss + '}';
    customStyle += '.mdc-list-item__content{' + answerCss + '}';
    customStyle += '.mat-mdc-form-field-error{ color:' + this.theme.main.alertColor + '}';

    //mat-select
    customStyle += '.mat-select-value{color:' + this.theme.answer.color + ' !important;}';
    customStyle += '.mat-select-placeholder{color:' + this.theme.main.color + ' !important;}';
    customStyle +=
      '.mdc-menu-surface{color:' +
      this.theme.main.color +
      ' !important; background-color:' +
      this.theme.main.backgroundColor +
      ' !important;}';
    customStyle += '.mat-mdc-select-arrow svg{fill:' + this.theme.main.color + ' !important;}';
    customStyle += '.mat-mdc-select-placeholder{color:' + this.theme.main.color + ' !important;}';
    customStyle += '.mat-mdc-select-value{color:' + this.theme.answer.color + ' !important;}';

    // button
    customStyle += `.mat-mdc-raised-button.mat-primary:not(:disabled) {
            --mat-button-protected-container-color: ${this.theme.nextButton.backgroundColor};
            --mat-button-protected-label-text-color:  ${this.theme.nextButton.color};
        }`;
    // .mat-mdc-raised-button.mat-primary:not(:disabled)  .mdc-button__label{
    //     ${nextButtonCss}
    // }  `;
    customStyle += '.mdc-buttont:not(.mat-mdc-button-disabled):not(:disabled){' + nextButtonCss + '}';
    customStyle += '.mdc-button.mat-cancel:not(.mat-mdc-button-disabled):not(:disabled){' + previousButtonCss + '}';

    // progressbar
    customStyle += `.mat-mdc-progress-bar .mdc-linear-progress__buffer-bar{
            background-color:${this.theme.progressBar.backgroundColor} !important;
        }
        .mat-mdc-progress-bar{
            --mat-progress-bar-active-indicator-color: ${this.theme.progressBar.color};

        } `;

    // پرسش امتیازی  - اسلایدر
    customStyle += '.ngx-slider .ngx-slider-pointer{background-color:' + this.theme.progressBar.color + ' !important;}';
    customStyle += '.ngx-slider .ngx-slider-bar{background:' + this.theme.progressBar.backgroundColor + ' !important;}';

    // جداول و ماتریس داینامیک
    customStyle += '.parent-title-in-mobile{' + questionCss + '}';
    customStyle += '.child-description-in-mobile{font-size:' + (this.theme.question.fontSize - 2) + 'px !important}';
    customStyle +=
      '.matrix-row-title{font-size:' +
      this.theme.question.fontSize +
      'px !important; font-family:' +
      this.theme.question.fontFamily +
      ' !important;}';
    customStyle += '.matrix-col-title{font-family:' + this.theme.question.fontFamily + ' !important; }';
    customStyle +=
      '.matrix-col-title,.matrix-answer-column,.matrix-answer-description{font-size:' +
      (this.theme.question.fontSize - 1) +
      'px !important}';
    if (this.theme.question.bold) {
      customStyle +=
        '.matrix-row-title,.matrix-col-title,.matrix-answer-column,.matrix-answer-description{ font-weight:bold !important;}';
    }
    if (this.theme.question.italic) {
      customStyle +=
        '.matrix-row-title,.matrix-col-title,.matrix-answer-column,.matrix-answer-description{ font-style:italic !important;}';
    }
    // table
    customStyle += '.table td,.table th{color:' + this.theme.main.color + ' !important;}';

    customStyle += '.highcharts-title{color:' + this.theme.main.color + ' !important;}';
    customStyle += '.highcharts-axis-labels,.highcharts-yaxis-labels{color:' + this.theme.main.color + ' !important;}';
    customStyle +=
      '.highcharts-axis-labels text,.highcharts-yaxis-labels text{color:' +
      this.theme.main.color +
      ' !important;fill:' +
      this.theme.main.color +
      ' !important;}';
    customStyle += '.highcharts-legend-item span{color:' + this.theme.main.color + ' !important;}';
    customStyle +=
      '.highcharts-axis-labels span, highcharts-xaxis-labels span{color:' + this.theme.main.color + ' !important;}';

    // header
    customStyle += '.pol-info {background-color:' + this.theme.header.backgroundColor + ';}';
    customStyle += '.pol-info .poll-info-content .logo-container .logo{width:' + this.theme.header.logoWidth + 'px;}';
    customStyle +=
      '.pol-info .poll-info-content{color:' +
      this.theme.header.color +
      ';font-size:' +
      this.theme.header.fontSize +
      'px;}';
    customStyle += '.pol-info {height:' + this.theme.header.height + 'px;   border: 1px #bababa4f solid;}';
    if (this.theme.header.backgroundImage)
      customStyle +=
        '.pol-info {background-image: url("' +
        this.theme.header.backgroundImage +
        '") !important;background-position:' +
        this.theme.header.backgroundPosition +
        ' !important;}';

    // header in mobile
    customStyle += '@media(max-width:768px){';
    if (this.theme.header.mobileBackgroundImage && this.theme.header.mobileBackgroundImage != 'noImage') {
      customStyle +=
        '.pol-info {background-image: url("' +
        this.theme.header.mobileBackgroundImage +
        '") !important; background-position:' +
        this.theme.header.mobileBackgroundPosition +
        ' !important; height:' +
        this.theme.header.mobileHeight +
        'px !important; }';
    }
    if (this.theme.header.mobileBackgroundImage === 'noImage') {
      customStyle +=
        '.pol-info {background-image: none !important; background-position:' +
        this.theme.header.mobileBackgroundPosition +
        ' !important; height:' +
        this.theme.header.mobileHeight +
        'px !important; }';
    }
    if (this.theme.header.mobileBackgroundColor) {
      customStyle +=
        '.pol-info {background-color:' +
        this.theme.header.mobileBackgroundColor +
        '; height:' +
        this.theme.header.mobileHeight +
        'px !important;}';
    }
    customStyle += '}';

    const dynamicStyle = this._document.querySelector('head #dynamic-theme-css');
    if (dynamicStyle) {
      dynamicStyle.innerHTML = customStyle;
    } else {
      const styles = this._document.createElement('STYLE') as HTMLStyleElement;
      styles.id = 'dynamic-theme-css';
      styles.innerHTML = customStyle;
      this._document.head.appendChild(styles);
    }

    // console.timeEnd('initialize theme');
  }

  private convertJsonToCss(data: any): string {
    if (!data) {
      return '';
    }
    let css = '';
    if (data.color) {
      css += 'color:' + data.color + ' !important;';
    }
    if (data.backgroundColor) {
      css += 'background-color:' + data.backgroundColor + ' !important;';
    }
    if (data.backgroundImage) {
      css += 'background-image:url("' + data.backgroundImage + '") !important;';
    }
    if (data.background) {
      css += 'background:' + data.background + ' !important;';
    }

    if (data.fontFamily) {
      // اگر زبان انگلیسی بود اگر فونت فارسی ست شود اعداد فارسی دیده خواهند شد
      if (!this.languageService.isRtl) {
        css += 'font-family:Axiforma !important;';
      } else if (this.languageService.languageName == 'ar') {
        css += 'font-family:AlKharashi !important;';
      } else {
        css += 'font-family:' + data.fontFamily + ' !important;';
      }
    }
    if (data.fontSize) {
      css += 'font-size:' + data.fontSize + 'px;';
    }
    if (data.bold) {
      css += 'font-weight: bold !important;';
    }
    if (data.italic) {
      css += 'font-style: italic !important;';
    }
    if (data.cover === true) {
      css += 'background-size: cover !important;';
    } else if (data.cover === false) {
      css += 'background-size: contain !important;';
    }
    if (data.repeat === true) {
      css += 'background-repeat: repeat !important;';
    } else if (data.repeat === false) {
      css += 'background-repeat: no-repeat !important;';
    }
    if (data.opacity !== undefined) {
      css += 'opacity:' + data.opacity + ' !important;';
    }

    if (data.align !== undefined) {
      css += 'text-align:' + data.align + ' !important;';
    }

    return css;
  }

  setMetaConfig(result: GetPollGuidByTokenOutputDto) {
    this.logoId = result.logoId || (result as any).logo;
    this.companyTitle = result.companyTitle ?? '';
    this._meta.addTag({
      property: 'og:url',
      content: window.location.href,
    });

    if (!result.title) {
      return;
    }
    this._title.setTitle(result.title);
    this._meta.addTag({
      property: 'og:title',
      content: result.title,
    });
    if (result.description) {
      this._meta.addTag({
        property: 'og:description',
        content: new StripHtmlPipe().transform(result.description),
      });
    }
  }
}
