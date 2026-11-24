import { Component, EventEmitter, Injector, OnInit, Output } from '@angular/core';
import { VoteBaseComponent } from '../vote-base.component';
import { setInterval, clearInterval } from 'worker-timers';

@Component({
  standalone: false,
  selector: 'timer-counter',
  templateUrl: './timer-counter.component.html',
  styleUrls: ['./timer-counter.component.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush,
  // providers: []
})
export class TimerCounterComponent extends VoteBaseComponent implements OnInit {
  @Output() timeEnd = new EventEmitter(false);
  timerCounter = 0;
  timer: any;

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.vote.pollData.pollingTime) {
      //pollingTime is minute
      this.timerCounter = this.vote.pollData.pollingTime * 60;
      this.startTimer();
    }
  }

  startTimer(): void {
    this.stopTimer();

    this.timer = setInterval(() => {
      this.timerCounter--;
      if (this.timerCounter === 30) {
        this.notify.info(this.translateService.instant('YouHave{value}SecondsLeft', { value: 30 }));
      }
      if (this.timerCounter === 20) {
        this.notify.info(this.translateService.instant('YouHave{value}SecondsLeft', { value: 20 }));
      }
      if (this.timerCounter === 10) {
        this.notify.info(this.translateService.instant('YouHave{value}SecondsLeft', { value: 10 }));
      }
      if (this.timerCounter < 2) {
        this.notify.error(this.translateService.instant('YourTimeIsUp'));
      }
      if (this.timerCounter <= 0) {
        this.pollingIsTimeOut();
      }
    }, 1000);
  }

  stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  pollingIsTimeOut(): void {
    // let btnSubmit: HTMLButtonElement | null = document.querySelector('#btnsubmitpage');
    // btnSubmit?.click();
    this.stopTimer();
    this.timeEnd.emit(true);
  }
}
