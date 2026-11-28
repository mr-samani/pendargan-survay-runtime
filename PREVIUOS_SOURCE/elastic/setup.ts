import { Injectable, isDevMode } from '@angular/core';
import { AppConsts } from '@core/app-consts';
import { GetDemographyDataForViewOutputDto } from '@core/models/backend-dto/GetDemographyDataForViewOutputDto';
import { ApmService } from '@elastic/apm-rum-angular';

@Injectable({
  providedIn: 'root',
})
export class ElasticService {
  constructor(private apmService: ApmService) {}
  initElastic() {
    if (AppConsts.elastic.active === false) {
      return;
    }
    if (isDevMode()) console.log('elsatic', AppConsts.elastic);
    this.apmService.init({
      active: AppConsts.elastic.active,
      serverUrl: AppConsts.elastic.serverUrl,
      serviceName: AppConsts.elastic.serviceName,
      environment: AppConsts.elastic.environment,
      logLevel: AppConsts.elastic.logLevel,
    });
    this.updateUserInfo();
  }

  updateUserInfo(demographyData?: GetDemographyDataForViewOutputDto) {
    if (AppConsts.elastic.active === false) {
      return;
    }
    //   service.apm.setUserContext({
    //     id: '',
    //     email: 'test',
    //     username: 'testUser',
    //   });
    let obj: { [key: string]: any } = {
      tenantId: AppConsts.tenantId,
      tenancyName: AppConsts.tenancyName,
    };
    if (demographyData) {
      if (demographyData.dynamicDataFieldTypeDtos) {
        for (const item of demographyData.dynamicDataFieldTypeDtos) {
          obj['Demography.Data.' + item.dynamicDataField.nameSpace] = item.value;
        }
      }
    }
    this.apmService.apm.setCustomContext(obj);
  }
}
