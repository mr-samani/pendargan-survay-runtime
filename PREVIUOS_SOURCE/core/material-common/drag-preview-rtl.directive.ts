import { CdkDragStart } from '@angular/cdk/drag-drop';

import { Directive, HostListener, Inject, DOCUMENT } from '@angular/core';

/**
 * fix bug drag drop in RTL
 */
@Directive({
  selector: '[cdkDrag]',
})
export class DragPreviewRtlDirective {
  isRtl = false;
  constructor(@Inject(DOCUMENT) private _document: Document) {}

  ngOnInit(): void {}

  checkPageDirection() {
    const htmlIsRtl = this._document.documentElement.dir == 'rtl';
    const bodyIsRtl = this._document.body.dir == 'rtl';
    this.isRtl = htmlIsRtl || bodyIsRtl;
  }

  @HostListener('cdkDragStarted', ['$event'])
  onMouseDown(event: Event) {
    this.checkPageDirection();
    if (this.isRtl) {
      let drgPrview = this._document.querySelector('.cdk-drag.cdk-drag-preview');
      if (drgPrview) drgPrview.removeAttribute('popover');
    }
  }
}
