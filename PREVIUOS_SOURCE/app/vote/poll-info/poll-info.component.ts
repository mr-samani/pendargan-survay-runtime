import { Component, EventEmitter, Injector, Input, OnInit, Output } from '@angular/core';
import { AppConsts } from '@core/app-consts';
import { VoteThemeService } from '../services/theme.service';
import { VoteBaseComponent } from '../vote-base.component';

@Component({
  standalone: false,
  selector: 'app-poll-info',
  templateUrl: './poll-info.component.html',
  styleUrls: ['./poll-info.component.scss'],
})
export class PollInfoComponent extends VoteBaseComponent implements OnInit {
  @Output() onStart = new EventEmitter<Boolean>();
  @Input() titleButtonToParticipate = '';
  appBaseUrl = AppConsts.baseUiUrl;
  isMinimalLogo = AppConsts.minimalLogo === true;
  isMobile = AppConsts.isMobile;

  constructor(
    public themeService: VoteThemeService,
    injector: Injector,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    const fullHeight = Math.max(
      this._document.body.scrollHeight,
      this._document.documentElement.scrollHeight,
      this._document.body.offsetHeight,
      this._document.documentElement.offsetHeight,
      this._document.body.clientHeight,
      this._document.documentElement.clientHeight,
    );
  }

  start() {
    this.onStart.emit(true);
  }
}
