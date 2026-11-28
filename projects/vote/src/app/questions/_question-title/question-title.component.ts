import { Component, computed } from '@angular/core';
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
  readonly displayTitle = computed(() => {
    const question = this.question();
    let title = question.effectiveTitle();
    if (
      question.isRequired &&
      question.questionType !== FormQuestionTypesEnum.Matrix_Dynamic &&
      question.questionType !== FormQuestionTypesEnum.Matrix &&
      !title.includes('<strong class="require-asterisk">*</strong>')
    ) {
      const marker = '<strong class="require-asterisk">*</strong>';
      title = title.endsWith('</p>')
        ? title.replace(/<\/p>$/, marker + '</p>')
        : title + marker;
    }
    return title;
  });

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }
}
