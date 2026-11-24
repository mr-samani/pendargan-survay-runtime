import { Component, Injector, Input, OnInit } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
export enum QuestionDirectionEnum {
  Rigth = 3,
  Center = 2,
  Left = 1,
}
@Component({
  standalone: false,
  selector: 'view-matrix',
  templateUrl: './view-matrix.component.html',
  styleUrl: './view-matrix.component.scss',
})
export class ViewMatrixQuestionComponent implements OnInit {
  @Input() item?: FormQuestionAnswerDto;

  ngOnInit(): void {
    if (this.item && this.item.questionChild)
      for (let q of this.item.questionChild) {
        for (let opt of q.questionOptionDto) {
          opt.selected = q.voterAnswerDetailDto.findIndex((x) => x.questionOptionUniqueId == opt.uniqueId) > -1;
        }
      }
  }

  public get QuestionDirectionEnum(): typeof QuestionDirectionEnum {
    return QuestionDirectionEnum;
  }

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }
}
