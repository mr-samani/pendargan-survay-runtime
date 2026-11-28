import { Component, Injector, Input, OnInit } from '@angular/core';
import { QuestionModel } from '@core/models/QuestionModel';
import { VoteBaseComponent } from '../../vote-base.component';
import { StripHtmlPipe } from '@core/pipe/strip-html.pipe';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';

@Component({
  standalone: false,
  selector: 'question-title',
  templateUrl: './question-title.component.html',
  styles: `
    :host {
      display: flex;
      justify-content: space-between;
    }
    svg.save-status {
      width: 24px;
      height: 24px;
    }
  `,
})
export class QuestionTitleComponent extends VoteBaseComponent implements OnInit {
  @Input() item!: QuestionModel;
  @Input() disabled = false;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (
      this.item.isRequired &&
      this.item.questionType !== FormQuestionTypesEnum.Matrix_Dynamic &&
      this.item.questionType !== FormQuestionTypesEnum.Matrix
    ) {
      if (this.item.title?.endsWith('</p>')) {
        if (this.item.title.includes('<strong class="require-asterisk">*</strong>') == false) {
          this.item.title = this.item.title.replace(
            new RegExp('</p>$'),
            '<strong class="require-asterisk">*</strong></p>',
          );
        }
      } else {
        if (this.item.title?.includes('<strong class="require-asterisk">*</strong>') == false) {
          this.item.title += '<strong class="require-asterisk">*</strong>';
        }
      }
    }
  }
}
