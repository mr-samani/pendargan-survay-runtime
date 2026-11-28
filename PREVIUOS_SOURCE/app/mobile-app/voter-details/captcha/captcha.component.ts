import { Component, OnInit, Input, Injector } from '@angular/core';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { FormQuestionAnswerDto } from '../models/voter-details';

@Component({
  standalone: false,
  selector: 'view-captcha',
  templateUrl: './captcha.component.html',
})
export class ViewCaptchaQuestionComponent implements OnInit {
  @Input() item!: FormQuestionAnswerDto;
  isValid = false;

  ngOnInit(): void {
    if (this.item && this.item.voterAnswerDetailDto && this.item.voterAnswerDetailDto.length > 0) {
      this.isValid = !isNullOrEmpty(this.item.voterAnswerDetailDto[0].validationGuid);
    }
  }
}
