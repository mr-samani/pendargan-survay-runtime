import { Component, OnInit } from '@angular/core';
import { AppConsts, HostEnum } from '@core/app-consts';

@Component({
  standalone: false,
  selector: 'app-loading',
  templateUrl: './loading-animation.component.html',
  styleUrls: ['./loading-animation.component.scss'],
})
export class LoadingAnimationComponent implements OnInit {
  host = AppConsts.host;
  constructor() {}

  ngOnInit(): void {}

  public get HostEnum(): typeof HostEnum {
    return HostEnum;
  }
}
