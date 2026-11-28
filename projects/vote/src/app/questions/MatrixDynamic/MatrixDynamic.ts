import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, computed } from '@angular/core';
import { QuestionBase } from '../shared/question.base';
import type { QuestionModel } from '../models/question';
import { buildMatrixDynamicLayout } from './matrix-dynamic-layout';

@Component({
  selector: 'question-matrix-dynamic',
  imports: [CommonModule, NgComponentOutlet],
  templateUrl: './MatrixDynamic.html',
  styleUrl: './MatrixDynamic.scss',
})
export class MatrixDynamic extends QuestionBase {
  readonly children = computed(() => {
    const parent = this.question();
    return this.vote.questions.filter((item) => item.parentUniqueId === parent.uniqueId);
  });

  readonly layout = computed(() =>
    buildMatrixDynamicLayout(this.children(), this.question().matrixParts),
  );

  readonly matrixConfig = computed(() => {
    const config = this.question().settings?.['matrixConfig'];
    return config && typeof config === 'object'
      ? config as { readonly simpleMode?: boolean; readonly responsiveInMobile?: boolean }
      : {};
  });

  cellVisible(child: QuestionModel): boolean {
    return child.isActive === true && child.runtimeVisibility() !== false && child.canShow();
  }

}
