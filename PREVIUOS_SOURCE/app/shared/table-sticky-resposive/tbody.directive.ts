import { AfterViewInit, Directive, ElementRef } from '@angular/core';

@Directive({
  standalone: false,
  selector: 'tbody[tableStickyTBody]',
})
export class TBodyDirective implements AfterViewInit {
  tds: Element[] = [];
  constructor(public el: ElementRef<HTMLTableRowElement>) {}

  ngAfterViewInit(): void {
    // let rows = this.el.nativeElement.rows;
    // for (let tr of rows) {
    //     for (let th of tr.children) {
    //         if (th.colSpan == 1) {
    //             this.ths.push(th);
    //         }
    //     }
    // }
    let row = this.el.nativeElement.querySelector('tr:first-child');
    if (row) {
      for (let td of Array.from(row.children)) {
        this.tds.push(td);
      }
    }
  }
}
