import { Component, OnInit, Input, Injector } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';
import { AppConsts } from '@core/app-consts';
import 'orderby-ts';

@Component({
  standalone: false,
  selector: 'view-file-upload',
  templateUrl: './file-upload.component.html',
})
export class ViewFileUploadQuestionComponent implements OnInit {
  item?: FormQuestionAnswerDto;
  @Input() baseUrl = AppConsts.fileServerUrl;
  @Input('item') set data(val: FormQuestionAnswerDto) {
    if (val && val.voterAnswerDetailDto && val.voterAnswerDetailDto.length) {
      val.voterAnswerDetailDto.map((m) => (m.files = m.files?.orderBy((s) => s.order, 'ASC')));
      this.item = val;
    }
  }
  imageTypes: string[] = ['.jpg', '.jpeg', '.png', '.gif', '.tif', '.bmp', '.heic', '.webp'];
  constructor() {}

  ngOnInit(): void {}
}
