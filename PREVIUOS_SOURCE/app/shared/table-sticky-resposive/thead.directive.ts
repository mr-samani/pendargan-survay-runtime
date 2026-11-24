import { AfterViewInit, Directive, ElementRef } from '@angular/core';

@Directive({
  standalone: false,
  selector: 'thead[tableStickyTHead]',
})
export class THeadDirective implements AfterViewInit {
  ths: Element[] = [];
  constructor(
    public el: ElementRef<HTMLTableRowElement>,
    //public templateRef: TemplateRef<any>
  ) {}

  ngAfterViewInit(): void {
    // let rows = this.el.nativeElement.rows;
    // for (let tr of rows) {
    //     for (let th of tr.children) {
    //         if (th.colSpan == 1) {
    //             this.ths.push(th);
    //         }
    //     }
    // }
    let rows = this.el.nativeElement.querySelector('tr:last-child');
    if (rows) {
      for (let th of Array.from(rows.children)) {
        this.ths.push(th);
      }
    }
  }
}
