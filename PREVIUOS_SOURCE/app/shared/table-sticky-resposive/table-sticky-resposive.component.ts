import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  DOCUMENT,
} from '@angular/core';
import { TBodyDirective } from './tbody.directive';
import { THeadDirective } from './thead.directive';
import { Subscription } from 'rxjs';

import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'ngx-table-sticky-resposive',
  templateUrl: './table-sticky-resposive.component.html',
  styleUrls: ['./table-sticky-resposive.component.scss'],
  encapsulation: ViewEncapsulation.None,
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableStickyResponsiveComponent implements AfterViewInit, OnDestroy {
  /** table width */
  @Input() width?: string;
  /**
   * inline or full width
   *
   * simple matrix is: full width
   * dynamic matrix is: inline
   */
  @Input() isInline = false;
  /** custom column size in matrix dynamic options */
  @Input() columnSize: { [ColumnIndex: number]: number } = {};

  /**
   * - for matrix is auto
   * - for matrix dynamic is fixed (for resize column)
   */
  @Input() tableLayout: 'fixed' | 'auto' = 'auto';
  setMaxHeight?: string;
  @ViewChild('tableContainer') tableContainer?: ElementRef<HTMLElement>;
  @ViewChild('tableBodyContainer') tableBodyContainer?: ElementRef<HTMLElement>;
  @ContentChild(TBodyDirective) tbody!: TBodyDirective;
  @ContentChild(THeadDirective) thead!: THeadDirective;

  scrollSubscription?: Subscription;
  constructor(
    private _renderer: Renderer2,
    private _changeDetectorRef: ChangeDetectorRef,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  ngAfterViewInit(): void {
    if (this.tableContainer) {
      this.adjustScroll(this.tableContainer.nativeElement);
      this.setHeaderSize();
      this.checkMaxHeight();
      // this.onScroll();
    }
  }

  ngOnDestroy(): void {
    if (this.scrollSubscription) this.scrollSubscription.unsubscribe();
  }

  @HostListener('window:resize')
  onResizeWindow() {
    this.ngAfterViewInit();
  }

  public update() {
    this.ngAfterViewInit();
  }

  private async setHeaderSize() {
    setTimeout(() => {
      if (this.tbody && this.thead) {
        let sizes = this.getFirstRowThSizes();
        for (let i = 0; i < this.thead.ths.length; i++) {
          let s = sizes[i];
          this._renderer.setStyle(this.thead.ths[i], 'width', s + 'px');
          this._renderer.setStyle(this.thead.ths[i], 'min-width', s + 'px');
          this._renderer.setStyle(this.thead.ths[i], 'max-width', s + 'px');
        }
      }
    }, 10);
  }

  private getFirstRowThSizes(): number[] {
    let sizes: number[] = [];
    if (this.tbody) {
      let firstRow = this.tbody.el.nativeElement.querySelector('tr:not([style^="display: none;"])');
      if (firstRow) {
        let colTitleIndex = this.thead.ths.findIndex((x) => x.classList.contains('is-question-title'));
        if (isNullOrEmpty(this.columnSize[colTitleIndex])) {
          this.columnSize[colTitleIndex] = 250;
        }
        for (let i = 0; i < Array.from(firstRow.children).length; i++) {
          if (this.columnSize[i]) {
            let s = this.columnSize[i];
            this._renderer.setStyle(firstRow.children[i], 'width', s + 'px');
            this._renderer.setStyle(firstRow.children[i], 'min-width', s + 'px');
            this._renderer.setStyle(firstRow.children[i], 'max-width', s + 'px');
          }
        }
        Array.from(firstRow.children).map((m) => sizes.push(m.getBoundingClientRect().width));
      }
    }
    return sizes;
  }

  private adjustScroll(table: HTMLElement) {
    const body = table.querySelector('.table-container');
    const header = table.querySelector('.table-header-container');
    if (!body || !header) return;
    body.addEventListener('scroll', () => {
      header.scrollLeft = body.scrollLeft;
    });
  }

  private checkMaxHeight() {
    const containerDoc = this._document.querySelector('.main-container');
    if (this.tbody && containerDoc) {
      const mainContainerWidth = containerDoc.getBoundingClientRect().width;
      const tbodyWidth = this.tbody.el.nativeElement.offsetWidth;
      const tbodyHeight = this.tbody.el.nativeElement.offsetHeight;
      const theadHeight = this.thead.el.nativeElement.offsetHeight;

      var availableHeight =
        window.innerHeight || this._document.documentElement.clientHeight || this._document.body.clientHeight;
      //with scroll
      //   const body = this._document.body,
      //   html = this._document.documentElement;
      //  Math.max(body.scrollHeight, body.offsetHeight,
      //     html.clientHeight, html.scrollHeight, html.offsetHeight);

      if (tbodyWidth > mainContainerWidth && tbodyHeight + theadHeight > availableHeight) {
        const footerHeight = 55; // this._document.querySelector('.fixed-bottom-button')?.getBoundingClientRect().height;
        this.setMaxHeight = `calc( 100vh - ${footerHeight}px - ${theadHeight}px)`;
      } else {
        this.setMaxHeight = undefined;
      }
      //   console.log('this.setMaxHeight', this.setMaxHeight)
      this._changeDetectorRef.detectChanges();
    }
  }

  // onScroll(): void {
  //   if (this.tableBodyContainer && !this.scrollSubscription) {
  //     this.scrollSubscription = fromEvent(this.tableBodyContainer.nativeElement, 'scroll')
  //       .pipe(
  //         debounceTime(100),
  //         map(() => {
  //           const html = this._document.querySelector('html');
  //           if (html && this.thead && this.tbody && this.tableBodyContainer) {
  //             var availableHeight =
  //               window.innerHeight || this._document.documentElement.clientHeight || this._document.body.clientHeight;
  //             if (this.tbody.el.nativeElement.offsetHeight > availableHeight) {
  //               html.scroll({
  //                 top: this.tableBodyContainer.nativeElement.offsetTop - this.thead.el.nativeElement.offsetHeight,
  //                 //, behavior: 'smooth'
  //               });
  //             }
  //           }
  //         }),
  //         distinctUntilChanged(),
  //       )
  //       .subscribe();
  //   }
  //}
}
