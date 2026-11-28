import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from '@app/base.component';

@Component({
  selector: 'online-status',
  templateUrl: './online-status.component.html',
  styleUrls: ['./online-status.component.scss'],
  standalone: false,
})
export class OnlineStatusComponent extends BaseComponent implements OnInit {
  isOffline: boolean;
  constructor(injector: Injector) {
    super(injector);
    this.isOffline = !navigator.onLine;
  }

  ngOnInit() {
    window.addEventListener('online', (event) => {
      console.log('You are now online!');
      this.isOffline = false;
    });

    window.addEventListener('offline', (event) => {
      console.log('You are now offline!');
      this.isOffline = true;
    });
  }
}
