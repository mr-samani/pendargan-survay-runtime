import { Component, input, Input, OnInit } from '@angular/core';

@Component({
  selector: 'spinner',
  template: '',
  styleUrls: ['./spinner.component.scss'],
  host: {
    '[style.--spinner-bg-border-color]': 'borderBgColor()',
    '[style.--spinner-border-color]': 'borderColor()',
    '[style.--diameter.px]': 'diameter()',
    '[style.--border-size.px]': 'borderSize()',
  },
})
export class SpinnerComponent {
  borderColor = input('#056edb');
  borderBgColor = input('#82b7ef');
  diameter = input(26);
  borderSize = input(2);
}
