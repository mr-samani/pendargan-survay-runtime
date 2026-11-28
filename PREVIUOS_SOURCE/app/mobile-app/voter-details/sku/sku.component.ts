import { Component, OnInit, Input, Injector } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';

@Component({
  standalone: false,
  selector: 'view-sku',
  templateUrl: './sku.component.html',
  styles: [
    `
      .table {
        width: unset !important;
        max-width: 100% !important;
      }
    `,
  ],
})
export class ViewSkuQuestionComponent implements OnInit {
  @Input() item?: FormQuestionAnswerDto;

  ngOnInit(): void {}
}
