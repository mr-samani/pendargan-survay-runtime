import { Component, OnInit, Input, Injector } from '@angular/core';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { FormQuestionAnswerDto } from '../models/voter-details';

@Component({
  standalone: false,
  selector: 'view-mobile-email',
  templateUrl: './mobile-email.component.html',
})
export class ViewMobileEmailQuestionComponent implements OnInit {
  @Input() item!: FormQuestionAnswerDto;
  isVerified = false;

  ngOnInit(): void {
    if (this.item && this.item.voterAnswerDetailDto && this.item.voterAnswerDetailDto.length > 0) {
      this.isVerified = !isNullOrEmpty(this.item.voterAnswerDetailDto[0].validationGuid);
    }
  }
}
