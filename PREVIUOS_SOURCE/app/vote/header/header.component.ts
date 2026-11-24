import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { VoteThemeService } from '../services/theme.service';
import { VoteBaseComponent } from '../vote-base.component';
import { MediaMatcher } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [CommonModule],
})
export class HeaderComponent extends VoteBaseComponent implements OnInit, OnDestroy {
  mobileQuery: MediaQueryList;
  showHeader = true;
  constructor(
    public themeService: VoteThemeService,
    injector: Injector,
    media: MediaMatcher,
  ) {
    super(injector);
    this.mobileQuery = media.matchMedia('(max-width: 768px)');

    this.mobileQuery.addListener(this._mobileQueryListener.bind(this));
  }

  ngOnDestroy(): void {
    this.mobileQuery.removeListener(this._mobileQueryListener.bind(this));
  }

  ngOnInit(): void {
    this._mobileQueryListener();
  }

  _mobileQueryListener() {
    if (this.mobileQuery.matches == true && this.themeService.theme.header.hasHeaderInMobile) {
      this.showHeader = true;
    } else if (this.mobileQuery.matches == false && this.themeService.theme.header.hasHeaderInDesktop) {
      this.showHeader = true;
    } else {
      this.showHeader = false;
    }
  }
}
