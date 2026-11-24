import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-text-number',
  templateUrl: './text-number.component.html',
  styleUrls: ['./text-number.component.scss'],
})
export class TextNumberComponent {
  num: number = 1025456798;
  dec = 1123.4560789;
  dec2 = 1123.4560789;
  dec3 = 1123.4560789;
  dec4?: number;
  aaa = 10000;

  alert(n: number) {
    alert(n);
  }
}
