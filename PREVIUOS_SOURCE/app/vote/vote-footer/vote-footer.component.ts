import { Component, Injector, Input, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { VoteBaseComponent } from '../vote-base.component';
import { AppConsts, HostEnum } from '@core/app-consts';
import { VoteThemeService } from '../services/theme.service';
import { SaveVoteService } from '../services/save-vote.service';
import { StripHtmlPipe } from '@core/pipe/strip-html.pipe';

@Component({
    standalone: false,
    selector: 'vote-footer',
    templateUrl: './vote-footer.component.html',
    styleUrls: ['./vote-footer.component.scss'],
})
export class VoteFooterComponent extends VoteBaseComponent implements OnInit {
    @Input() questionForm!: NgForm;
    host = AppConsts.host;
    isMobile = AppConsts.isMobile;
    isMinimalLogo = AppConsts.minimalLogo === true;
    constructor(
        injector: Injector,
        public themeService: VoteThemeService,
        public saveVoteService: SaveVoteService
    ) {
        super(injector);
    }

    ngOnInit(): void {}

    public get HostEnum(): typeof HostEnum {
        return HostEnum;
    }

    /**
     * 1- بررسی ولیدیشن سوالات و در صورتی که در تنظیمات نظر سنجی کانفیرم از کاربر وجد دارد پیام نمایش داده شود
     */
    async submitFormInit(form: NgForm, isSaveTemp = false): Promise<void> {
        if (this.vote.isLoadingNext || this.vote.isLoadingPrevious || this.saveVoteService.isSavingForm) {
            return;
        }
        // if (this.isSavingForm) {
        //   return;
        // }
        // if (this.placeForm.invalid) {
        //   this.notify.warning('لطفاً مکان ها را تکمیل کنید.', 'خطا');
        //   this.placeForm.markAllAsTouched();
        //   this.vote.showRequiredFormQuestionValidate = true;
        //   return;
        // }
        if (form.invalid && !isSaveTemp) {
            const invalidQuestions = this.vote.questionList
                .filter((x) => x.invalid && !x.dontShow && x.hasVisibleQuestionOrOption)
                .map((m) => m.title);
            let htmlTitles = '<ul>';
            invalidQuestions
                .slice(0, 5)
                .forEach(
                    (t) => (htmlTitles += `<li><div class="q-title"> ${new StripHtmlPipe().transform(t)}</div></li>`)
                );
            htmlTitles += '</ul>';
            if (invalidQuestions.length > 5) {
                htmlTitles += `<p class="and-more"> ${this.translateService.instant('AndMoreOther', { value: invalidQuestions.length - 5 })} </p>`;
            }

            this.alert.show({
                title: this.translateService.instant('CompleteFormInformationCorrectly'),
                html: `<div class="invalidQuestionLists">${htmlTitles}</div>`,
                confirmButtonText: this.translateService.instant('Ok'),
                containerClass: 'alert-invalid-questions',
            });
            form.control.markAllAsTouched();
            this.vote.showRequiredFormQuestionValidate = true;
            this.logicService.scrollToFirstInvalidControl();
            return;
        }
        if (this.vote.pollData.hasRegion && !this.vote.lastRegionChildId && !isSaveTemp) {
            this.notify.warning(this.translateService.instant('SelectPlaceIsRequired'));
            window.scrollTo({ top: 0 });
            return;
        }
        this.vote.showRequiredFormQuestionValidate = false;

        if (!isSaveTemp && (this.vote.pollData.getConfirmationBeforSubmit || AppConsts.isMobile)) {
            this.alert
                .show({
                    title: this.translateService.instant('SaveData'),
                    text: this.translateService.instant('SaveDataConfirmation'),
                    showConfirmButton: true,
                    confirmButtonText: this.translateService.instant('Ok'),
                    showCancelButton: true,
                    cancelButtonText: this.translateService.instant('Cancel'),
                })
                .then((result: { isConfirmed: any }) => {
                    if (result.isConfirmed) {
                        this.saveVoteService.submitForm(this.vote, form, isSaveTemp);
                    }
                });
        } else {
            this.saveVoteService.submitForm(this.vote, form, isSaveTemp);
        }
    }

    getDomainName(): string {
        const hostName = this._document.location.hostname;
        return hostName.substring(hostName.lastIndexOf('.', hostName.lastIndexOf('.') - 1) + 1);
    }

    /**
     * مهلت ثبت پاسخ نظرسنجی به اتمام رسیده است
     * - در صورتی که فرم قابل ثبت باشد به سرور ارسال شود
     * - در صورتی که فرم تکمیل نشده باشد باید بسته شود
     * @param ev boolean
     */
    onTimeEnded(ev: boolean, form: NgForm) {
        if (!form.invalid) {
            this.saveVoteService.submitForm(this.vote, form, false, true);
        } else {
            this.publicService.closeWindow(this.vote.pollData.addressLink, true);
        }
    }

    saveAsTemp() {
        this.alert
            .show({
                title: this.translateService.instant('SaveData'),
                text: this.translateService.instant('SaveDataConfirmation'),
                showConfirmButton: true,
                confirmButtonText: this.translateService.instant('Ok'),
                showCancelButton: true,
                cancelButtonText: this.translateService.instant('Cancel'),
            })
            .then((result: { isConfirmed: any }) => {
                if (result.isConfirmed) {
                    this.saveVoteService.submitForm(this.vote, this.questionForm, true);
                }
            });
    }

    async showPwaLoadAnswerInfoDialog() {
        this.vote.showPwaLoadAnswersInfoFliker = false;
        const { PwaLoadAnswerInfoDialogComponent } = await import('../pwa-load-answer-info/pwa-load-answer-info');
        this.matDialog.open(PwaLoadAnswerInfoDialogComponent, {
            data: {
                lang: this.vote.languageName,
            },
        });
    }
}
