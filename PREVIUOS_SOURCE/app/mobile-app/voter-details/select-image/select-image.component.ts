import { Component, OnInit, Input, Injector } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';
import { AppConsts } from '@core/app-consts';

@Component({
  standalone: false,
  selector: 'view-select-image',
  templateUrl: './select-image.component.html',
})
export class ViewSelectImageQuestionComponent implements OnInit {
  @Input() item?: FormQuestionAnswerDto;
  noImage = AppConsts.baseUiUrl + '/assets/images/no-image.png';
  @Input() baseUrl = AppConsts.fileServerUrl;
  constructor() {}

  ngOnInit(): void {}
}
