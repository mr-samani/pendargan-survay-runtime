import { Component, Injector, Input, OnInit } from '@angular/core';
import { BaseComponent } from '@app/base.component';

@Component({
  standalone: false,
  selector: 'no-result-found',
  templateUrl: './no-result-found.component.html',
  styleUrls: ['./no-result-found.component.scss'],
})
export class NoResultFoundComponent extends BaseComponent implements OnInit {
  @Input() title = '';
  @Input() description = '';
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (!this.title) {
      this.title = this.translateService.instant('NoData');
    }
  }
}
