import { Component, Injector, Input, OnInit } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';

export class MatrixColumn {
  uniqueId!: string;
  description?: string;
  questionType?: FormQuestionTypesEnum;
  isEdit?: boolean;
}
export class MatrixRow {
  uniqueId!: string;
  title?: string;
  isEdit?: boolean;

  //panel on mobile
  isOpen?: boolean;
}

@Component({
  standalone: false,
  selector: 'view-matrix-dynamic',
  templateUrl: './view-matrix-dynamic.component.html',
})
export class ViewMatrixDynamicQuestionComponent implements OnInit {
  @Input() item?: FormQuestionAnswerDto;

  cols: MatrixColumn[] = [];
  rows: MatrixRow[] = [];

  ngOnInit(): void {
    this.generateColAndRow();
  }

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }
  generateColAndRow() {
    if (!this.item || !this.item.matrixParts || !this.item.questionChild) {
      return;
    }
    this.cols = [];
    for (let colNum = 0; colNum < this.item.matrixParts; colNum++) {
      this.cols.push({
        uniqueId: this.item.questionChild[colNum]?.uniqueId,
        questionType: this.item.questionChild[colNum]?.questionType,
        description: this.item.questionChild[colNum]?.description,
        isEdit: false,
      });
    }
    const rowCount = this.item.questionChild.length / this.item.matrixParts;
    this.rows = [];
    for (let rowNum = 0; rowNum < rowCount; rowNum++) {
      this.rows.push({
        uniqueId: this.item.questionChild[this.cols.length * rowNum]?.uniqueId,
        title: this.item.questionChild[this.cols.length * rowNum]?.title,
        isEdit: false,
      });
    }
  }
}
