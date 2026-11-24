import { Component, effect } from '@angular/core';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';

@Component({
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
  imports: [QuestionSharedModule],
})
export class QuestionTitleComponent extends QuestionBase {
  constructor() {
    super();
    effect(() => {
      const q = this.question();
      if (
        q.isRequired &&
        q.questionType !== FormQuestionTypesEnum.Matrix_Dynamic &&
        q.questionType !== FormQuestionTypesEnum.Matrix
      ) {
        if (q.title?.endsWith('</p>')) {
          if (q.title.includes('<strong class="require-asterisk">*</strong>') == false) {
            q.title = q.title.replace(
              new RegExp('</p>$'),
              '<strong class="require-asterisk">*</strong></p>',
            );
          }
        } else {
          if (q.title?.includes('<strong class="require-asterisk">*</strong>') == false) {
            q.title += '<strong class="require-asterisk">*</strong>';
          }
        }
      }
    });
  }

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }
}
