import { ChangeDetectionStrategy, Component, Injector, Input, OnInit } from '@angular/core';
import { DynamicDataFieldTypeDto } from '@core/models/backend-dto/DynamicDataFieldTypeDto';

@Component({
  standalone: false,
  selector: 'view-demographic',
  templateUrl: './view-demographic.component.html',
  styleUrls: ['./view-demographic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewDemographicComponent implements OnInit {
  @Input() demographyData: DynamicDataFieldTypeDto[] = [];

  ngOnInit(): void {}
}
