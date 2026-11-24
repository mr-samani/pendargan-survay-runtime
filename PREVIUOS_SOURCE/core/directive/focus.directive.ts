import { Directive, OnInit, ElementRef, Renderer2, Input, OnChanges } from '@angular/core';

@Directive({
  standalone: false,
  selector: '[focus]',
})
export class FocusDirective implements OnChanges {
  @Input('focus') isFocused = true;

  constructor(
    private hostElement: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnChanges() {
    if (this.isFocused) {
      this.hostElement.nativeElement.focus();
    }
  }
}
