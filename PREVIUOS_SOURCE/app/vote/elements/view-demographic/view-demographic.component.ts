import { ChangeDetectionStrategy, Component, Injector, Input, OnInit } from '@angular/core';
import { DynamicDataFieldTypeEnum } from '@core/models/backend-dto/DynamicDataFieldTypeEnum';
import { DynamicDataFieldTypeDto } from '@core/models/backend-dto/DynamicDataFieldTypeDto';
import { GetDemographyDataForViewOutputDto } from '@core/models/backend-dto/GetDemographyDataForViewOutputDto';
import { VoteBaseComponent } from '../../vote-base.component';
import { AppConsts } from '@core/app-consts';
declare var appCommand: any;

@Component({
  standalone: false,
  selector: 'view-demographic',
  templateUrl: './view-demographic.component.html',
  styleUrls: ['./view-demographic.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewDemographicComponent extends VoteBaseComponent implements OnInit {
  @Input() demographyData?: GetDemographyDataForViewOutputDto;
  title = '';

  viewDemographic: DynamicDataFieldTypeDto[] = [];
  isKBrowser: boolean;
  constructor(injector: Injector) {
    super(injector);
    this.isKBrowser = AppConsts.isKBrowser;
  }

  ngOnInit(): void {
    if (this.demographyData) {
      if (!this.demographyData.fieldNamespacesToShow) {
        this.demographyData.fieldNamespacesToShow = [];
      }
      if (this.demographyData.activeDynamicDataDescription) {
        this.title = this.demographyData.activeDynamicDataDescription;
      }

      for (let item of this.demographyData.fieldNamespacesToShow) {
        let finded = this.demographyData.dynamicDataFieldTypeDtos?.find((x) => x.dynamicDataField.nameSpace === item);
        if (finded) {
          this.viewDemographic.push(finded);
        }
      }
    }
  }

  public get DynamicDataFieldTypeEnum(): typeof DynamicDataFieldTypeEnum {
    return DynamicDataFieldTypeEnum;
  }

  callNumber(mobile: string | undefined) {
    if (!mobile) return;
    try {
      appCommand.callNumber(mobile);
    } catch (error) {
      console.error('KBrowser', error);
    }
  }
}
