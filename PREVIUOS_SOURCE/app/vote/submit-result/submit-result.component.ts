import { Component, Injector, OnInit } from '@angular/core';
import { VoteBaseComponent } from '../vote-base.component';
import { SaveVoteService } from '../services/save-vote.service';
import { VoteThemeService } from '../services/theme.service';
import { AppConsts } from '@core/app-consts';
import { PlatformLocation } from '@angular/common';

@Component({
  selector: 'app-submit-result',
  templateUrl: './submit-result.component.html',
  styleUrls: ['./submit-result.component.scss'],
  standalone: false,
})
export class SubmitResultComponent extends VoteBaseComponent implements OnInit {
  trackingCode: string;

  message = '';
  message2 = '';

  newForm = false;

  returnUrl = '';

  isMobile = AppConsts.isMobile;

  closeBtnTitle = this.translateService.instant('Close');
  dontShowCloseBtn = false;
  constructor(
    injector: Injector,

    private saveVoteService: SaveVoteService,
    private voteTheme: VoteThemeService,
    private platformLocation: PlatformLocation,
  ) {
    super(injector);
    this.trackingCode = this.route.snapshot.queryParams['trackingCode'];
    this.message2 = this.route.snapshot.queryParams['message'];
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'];
    let lang = this.route.snapshot.queryParams['lang'];
    this.languageService.setPageLanguageAndDirection(lang);
  }

  ngOnInit() {
    if (!this.vote.pollData?.uniqueId) {
      this.router.navigate([this.returnUrl ?? '/']);
      return;
    }
    this.message = `<h3>${this.translateService.instant('SavedVoteSuccessFully')}</h3>`;

    if (this.voteTheme.theme.submitPollSetting.html) {
      this.message = this.voteTheme.theme.submitPollSetting.html;
    }

    if (this.voteTheme.theme.submitPollSetting.btnTitle) {
      this.closeBtnTitle = this.voteTheme.theme.submitPollSetting.btnTitle;
    }
    if (this.voteTheme.theme.submitPollSetting.dontShowCloseButton == true) {
      this.dontShowCloseBtn = true;
    }

    if (this.vote.pollData.messageAfterVoting) {
      this.message = this.vote.getMessageAfterVoting();
    }
    this.newForm = this.vote.hasReRegistrationForm === true;
  }

  close() {
    this.saveVoteService.closeWindow(this.vote);
  }
  copy() {
    this.notify.success(this.translateService.instant('CopiedToClipboard'));
  }

  reloadForm() {
    const baseHref = this.getBaseHref();
    let link = baseHref + this.returnUrl;
    link = link.replace('//', '/');
    location.href = link;
  }
  getBaseHref(): string {
    let baseUrl = this.platformLocation.getBaseHrefFromDOM();
    if (baseUrl) {
      return baseUrl;
    }

    return '/';
  }
}
