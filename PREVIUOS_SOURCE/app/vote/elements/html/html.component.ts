import { Component, DOCUMENT, inject, Injector, Input, OnInit } from '@angular/core';
import { QuestionModel } from '@core/models/QuestionModel';
import { VoteBaseComponent } from '../../vote-base.component';

@Component({
  standalone: false,
  selector: 'html-frame',
  templateUrl: './html.component.html',
  styleUrls: ['./html.component.scss'],
})
export class HtmlComponent extends VoteBaseComponent implements OnInit {
  @Input() item!: QuestionModel;
  doc = inject(DOCUMENT);
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.item.settings?.stickyPosition) {
      this.setStickyPosition();
    }
  }

  setStickyPosition() {
    const findEl = this.doc.querySelector('.qid-' + this.item.fid)?.parentElement;
    if (findEl) {
      findEl.classList.add('sticky-position');
      if (this.item.parentUniqueId) {
        findEl.classList.add('is-child');
      }
    }
  }
}
