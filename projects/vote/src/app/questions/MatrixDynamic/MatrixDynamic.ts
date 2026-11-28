import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, computed } from '@angular/core';
import { QuestionBase } from '../shared/question.base';
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
    const children = this.vote.questions
      .filter((item) => item.parentUniqueId === parent.uniqueId)
      .sort((left, right) =>
        (left.childSortKey ?? left.sortKey ?? 0) - (right.childSortKey ?? right.sortKey ?? 0),
      );
    return children;
  });

  readonly layout = computed(() =>
    buildMatrixDynamicLayout(this.children(), this.question().matrixParts),
  );

  readonly matrixConfig = computed(() => {
    const config = this.question().settings?.['matrixConfig'];
    return config && typeof config === 'object'
      ? config as { readonly simpleMode?: boolean; readonly columnSize?: Readonly<Record<number, number>>; readonly responsiveInMobile?: boolean }
      : {};
  });

  cellVisible(child: (typeof this.children extends never ? never : any)): boolean {
    return child.isActive === true && child.runtimeVisibility() !== false && child.canShow();
  }

  columnWidth(index: number): string | null {
    const width = this.matrixConfig().columnSize?.[index];
    return typeof width === 'number' && Number.isFinite(width) && width > 0
      ? `${width}%`
      : null;
  }
}
