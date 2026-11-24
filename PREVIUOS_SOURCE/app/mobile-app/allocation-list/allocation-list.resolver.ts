import { Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { catchError, finalize, map, Observable, of } from 'rxjs';
import { AppConsts } from '@core/app-consts';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { DynamicDataProcessed, LoadDemographicInputDto, LoadDemographicOutputDto } from './allocation-list.model';
import { normalizeText } from '@core/helper/normalize-text';
import { IResponse } from '@core/models/response';

@Injectable()
export class AllocationListResolver extends MobileAppBaseComponent implements Resolve<DynamicDataProcessed[] | null> {
  constructor(injector: Injector) {
    super(injector);
  }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<DynamicDataProcessed[] | null> {
    let trackingCode = route.queryParams['trackingCode'];
    let pollUniqueId = route.queryParams['pollUniqueId'];
    let pollId = route.queryParams['pollId'];
    let dynamicDataId = route.queryParams['dynamicDataId'];

    const input = new LoadDemographicInputDto();
    input.id = pollId;
    input.pollUniqueId = pollUniqueId;
    input.trackingCode = trackingCode;
    input.dynamicDataId = dynamicDataId;

    /**
     * this line Only for test
     *
     * - https://localhost:4444/app/allocation
     */
    return (
      /** for test localy */
      //  this.returnFakeData()
      this.dataService
        .post<LoadDemographicOutputDto>(AppConsts.hybridUrl + AppConsts.pwaUrls.allocationList, input)
        .pipe(
          finalize(() => {}),
          map((response) => {
            const data = response.result ?? {};
            const list = [];
            for (let item of Object.entries(data)) {
              if (item[1].id) {
                item[1].id = normalizeText(item[1].id);
              }
              if (item[1].dataProcessed) {
                for (let obj of Object.entries(item[1].dataProcessed)) {
                  if (obj[1]) {
                    obj[1] = normalizeText(obj[1]);
                  }
                }
              }
              list.push(item[1]);
            }
            return list;
          }),
          catchError((error) => {
            //// this.languageService.setPageLanguageAndDirection('fa');

            if (error.status === 404) {
              this.translateService.get('NotFoundAnyItems').subscribe((notfound) => {
                this.alert
                  .show({
                    title: '404',
                    text: notfound,
                    confirmButtonText: this.translateService.instant('Ok'),
                  })
                  .then((result) => {
                    this.publicService.closeWindow();
                  });
              });
            } else {
              this.handleApiError(error, true);
            }
            return of(null);
          }),
        )
    );
  }

  returnFakeData(): Observable<IResponse<LoadDemographicOutputDto>> {
    this.languageService.setPageLanguageAndDirection('fa');
    return of(<any>{
      result: {
        '5799': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '۵۷۹۹',
          dataRaw: {
            mobile: '9111281093',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0627\u0645\u06CC\u0631\u0631\u060C\u0645\u0647\u062F\u0634\u062A',
            address:
              '\u0628\u0644\u0648\u0627\u0631 \u06A9\u0634\u0627\u0648\u0631\u0632\u060C\u0648\u0631\u0648\u062F\u06CC \u0645\u0647\u062F\u0634\u062A',
            type: '\u0645\u0648\u0644\u062A\u06CC \u0628\u0631\u0646\u062F',
            main_area: '\u06A9\u0634\u0627\u0648\u0631\u0632',
            id: '5799',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '33228008',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0627\u0642\u0627\u06CC \u062D\u0633\u0646\u067E\u0648\u0631',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5799',
            mobile: '9111281093',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0627\u0645\u06CC\u0631\u0631\u060C\u0645\u0647\u062F\u0634\u062A',
            address:
              '\u0628\u0644\u0648\u0627\u0631 \u06A9\u0634\u0627\u0648\u0631\u0632\u060C\u0648\u0631\u0648\u062F\u06CC \u0645\u0647\u062F\u0634\u062A',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0627\u0642\u0627\u06CC \u062D\u0633\u0646\u067E\u0648\u0631',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5799\r\nmobile\t:\t9111281093\r\ncity\t:\t\u0633\u0627\u0631\u06CC\r\nshopname\t:\t\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0627\u0645\u06CC\u0631\u0631\u060C\u0645\u0647\u062F\u0634\u062A\r\naddress\t:\t\u0628\u0644\u0648\u0627\u0631 \u06A9\u0634\u0627\u0648\u0631\u0632\u060C\u0648\u0631\u0648\u062F\u06CC \u0645\u0647\u062F\u0634\u062A\r\nshopcode\t:\t0\r\nprovince\t:\t\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646\r\nname\t:\t\u0627\u0642\u0627\u06CC \u062D\u0633\u0646\u067E\u0648\u0631',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-07-30T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
        '5831': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '5831',
          dataRaw: {
            mobile: '9117360210',
            city: '\u0633\u0627\u0631\u06CC',
            shopname: '\u06AF\u0627\u0644\u0631\u06CC \u0645\u0646\u062A\u0638\u0631',
            address:
              '\u0633\u0627\u0631\u06CC \u0645\u06CC\u062F\u0627\u0646 \u0634\u0647\u062F\u0627\u060C\u0627\u0628\u062A\u062F\u0627\u06CC 18 \u062F\u06CC',
            type: '\u0645\u0648\u0644\u062A\u06CC \u0628\u0631\u0646\u062F',
            main_area: '\u0634\u0647\u062F\u0627',
            id: '5831',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '33254226',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0645\u0646\u062A\u0638\u0631',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5831',
            mobile: '9117360210',
            city: '\u0633\u0627\u0631\u06CC',
            shopname: '\u06AF\u0627\u0644\u0631\u06CC \u0645\u0646\u062A\u0638\u0631',
            address:
              '\u0633\u0627\u0631\u06CC \u0645\u06CC\u062F\u0627\u0646 \u0634\u0647\u062F\u0627\u060C\u0627\u0628\u062A\u062F\u0627\u06CC 18 \u062F\u06CC',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0645\u0646\u062A\u0638\u0631',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5831\r\ncity\t:\t\u0633\u0627\u0631\u06CC\r\nshopname\t:\t\u06AF\u0627\u0644\u0631\u06CC \u0645\u0646\u062A\u0638\u0631',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-08-06T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
        '5830': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '5830',
          dataRaw: {
            mobile: '9366906133',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0631\u0626\u06CC\u0633\u06CC\u0627\u0646',
            address:
              '\u0633\u0627\u0631\u06CC\u060C\u062E\u06CC\u0627\u0628\u0627\u0646 18 \u062F\u06CC\u060C\u0627\u0628\u062A\u062F\u0627\u06CC \u06A9\u0648\u0686\u0647 \u067E\u06CC\u0631\u062A\u06A9\u06CC\u0647',
            type: '\u0645\u0648\u0644\u062A\u06CC \u0628\u0631\u0646\u062F',
            main_area: '\u0634\u0647\u062F\u0627',
            id: '5830',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '0',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0631\u0626\u06CC\u0633\u06CC\u0627\u0646',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5830',
            mobile: '9366906133',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0631\u0626\u06CC\u0633\u06CC\u0627\u0646',
            address:
              '\u0633\u0627\u0631\u06CC\u060C\u062E\u06CC\u0627\u0628\u0627\u0646 18 \u062F\u06CC\u060C\u0627\u0628\u062A\u062F\u0627\u06CC \u06A9\u0648\u0686\u0647 \u067E\u06CC\u0631\u062A\u06A9\u06CC\u0647',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0631\u0626\u06CC\u0633\u06CC\u0627\u0646',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5830\r\nmobile\t:\t9366906133\r\nshopname\t:\t\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0631\u0626\u06CC\u0633\u06CC\u0627\u0646\r\naddress\t:\t\u0633\u0627\u0631\u06CC\u060C\u062E\u06CC\u0627\u0628\u0627\u0646 18 \u062F\u06CC\u060C\u0627\u0628\u062A\u062F\u0627\u06CC \u06A9\u0648\u0686\u0647 \u067E\u06CC\u0631\u062A\u06A9\u06CC\u0647\r\nname\t:\t\u0631\u0626\u06CC\u0633\u06CC\u0627\u0646',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-08-06T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
        '5678': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '5678',
          dataRaw: {
            mobile: '9358541424',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0628\u0631\u0646\u062F\u0634\u0627\u067E \u0627\u0633\u0646\u0648\u0627\u060C\u0634\u0647\u062F\u0627 \u0633\u0627\u0631\u06CC',
            address:
              '\u0633\u0627\u0631\u06CC\u060C\u0645\u06CC\u062F\u0627\u0646 \u0634\u0647\u062F\u0627\u060C\u0646\u0628\u0634 \u0648\u0631\u062F\u06CC \u0645\u0635\u0644\u06CC',
            type: '\u0628\u0631\u0646\u062F\u0634\u0627\u067E',
            main_area: '\u0634\u0647\u062F\u0627',
            id: '5678',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '1133241186',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0633\u0644\u0645\u0627\u0646\u06CC',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5678',
            mobile: '9358541424',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0628\u0631\u0646\u062F\u0634\u0627\u067E \u0627\u0633\u0646\u0648\u0627\u060C\u0634\u0647\u062F\u0627 \u0633\u0627\u0631\u06CC',
            address:
              '\u0633\u0627\u0631\u06CC\u060C\u0645\u06CC\u062F\u0627\u0646 \u0634\u0647\u062F\u0627\u060C\u0646\u0628\u0634 \u0648\u0631\u062F\u06CC \u0645\u0635\u0644\u06CC',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0633\u0644\u0645\u0627\u0646\u06CC',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5678\r\nmobile\t:\t9358541424\r\nshopname\t:\t\u0628\u0631\u0646\u062F\u0634\u0627\u067E \u0627\u0633\u0646\u0648\u0627\u060C\u0634\u0647\u062F\u0627 \u0633\u0627\u0631\u06CC\r\nshopcode\t:\t0\r\nname\t:\t\u0633\u0644\u0645\u0627\u0646\u06CC',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-07-16T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
        '5796': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '5796',
          dataRaw: {
            mobile: '9118113546',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0634\u0639\u0628\u0627\u0646\u06CC',
            address:
              '\u0633\u0627\u0631\u06CC \u060C\u0628\u0644\u0648\u0627\u0631 \u062F\u0627\u0646\u0634\u062C\u0648\u060C\u0631\u0648\u0628\u0647 \u0631\u0648\u06CC \u062E\u06CC\u0627\u0628\u0627\u0646 \u0630\u0627\u06A9\u0631\u06CC\u0646',
            type: '\u0645\u0648\u0644\u062A\u06CC \u0628\u0631\u0646\u062F',
            main_area: '\u0628\u0644\u0648\u0627\u0631 \u062F\u0627\u0646\u0634\u062C\u0648',
            id: '5796',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '0',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0627\u0642\u0627\u06CC \u0634\u0639\u0628\u0627\u0646\u06CC',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5796',
            mobile: '9118113546',
            city: '\u0633\u0627\u0631\u06CC',
            shopname:
              '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0634\u0639\u0628\u0627\u0646\u06CC',
            address:
              '\u0633\u0627\u0631\u06CC \u060C\u0628\u0644\u0648\u0627\u0631 \u062F\u0627\u0646\u0634\u062C\u0648\u060C\u0631\u0648\u0628\u0647 \u0631\u0648\u06CC \u062E\u06CC\u0627\u0628\u0627\u0646 \u0630\u0627\u06A9\u0631\u06CC\u0646',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0627\u0642\u0627\u06CC \u0634\u0639\u0628\u0627\u0646\u06CC',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5796\r\nmobile\t:\t9118113546\r\ncity\t:\t\u0633\u0627\u0631\u06CC\r\nshopname\t:\t\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0634\u0639\u0628\u0627\u0646\u06CC\r\naddress\t:\t\u0633\u0627\u0631\u06CC \u060C\u0628\u0644\u0648\u0627\u0631 \u062F\u0627\u0646\u0634\u062C\u0648\u060C\u0631\u0648\u0628\u0647 \u0631\u0648\u06CC \u062E\u06CC\u0627\u0628\u0627\u0646 \u0630\u0627\u06A9\u0631\u06CC\u0646\r\nshopcode\t:\t0\r\nprovince\t:\t\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646\r\nname\t:\t\u0627\u0642\u0627\u06CC \u0634\u0639\u0628\u0627\u0646\u06CC',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-07-30T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
        '5797': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '5797',
          dataRaw: {
            mobile: '09120970501',
            city: '\u0633\u0627\u0631\u06CC',
            shopname: '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0642\u0627\u062F\u0631\u06CC',
            address:
              '\u062E\u06CC\u0627\u0628\u0627\u0646 \u0646\u0648\u0631\u06CC\u060C\u0646\u0628\u0634 \u0646\u0648\u0631\u06CC 1',
            type: '\u0645\u0648\u0644\u062A\u06CC \u0628\u0631\u0646\u062F',
            main_area: '\u0622\u0632\u0627\u062F\u06CC',
            id: '5797',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '0',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0642\u0627\u062F\u0631\u06CC',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5797',
            mobile: '09120970501',
            city: '\u0633\u0627\u0631\u06CC',
            shopname: '\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0642\u0627\u062F\u0631\u06CC',
            address:
              '\u062E\u06CC\u0627\u0628\u0627\u0646 \u0646\u0648\u0631\u06CC\u060C\u0646\u0628\u0634 \u0646\u0648\u0631\u06CC 1',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0642\u0627\u062F\u0631\u06CC',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5797\r\nmobile\t:\t09120970501\r\ncity\t:\t\u0633\u0627\u0631\u06CC\r\nshopname\t:\t\u0644\u0648\u0627\u0632\u0645 \u062E\u0627\u0646\u06AF\u06CC \u0642\u0627\u062F\u0631\u06CC\r\naddress\t:\t\u062E\u06CC\u0627\u0628\u0627\u0646 \u0646\u0648\u0631\u06CC\u060C\u0646\u0628\u0634 \u0646\u0648\u0631\u06CC 1\r\nshopcode\t:\t0\r\nprovince\t:\t\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646\r\nname\t:\t\u0642\u0627\u062F\u0631\u06CC',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-07-30T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
        '5795': {
          filtersNameSpace: ['HasVote'],
          searchKeyNameSpace: null,
          searchKeyData: null,
          filtersNameSpaceWithData: [
            {
              key: 'HasVote',
              value: '\u0641\u0627\u0642\u062F \u067E\u0627\u0633\u062E\u0646\u0627\u0645\u0647',
            },
          ],
          id: '5795',
          dataRaw: {
            mobile: '9111574458',
            city: '\u0633\u0627\u0631\u06CC',
            shopname: '\u0633\u0627\u0631\u06CC \u0633\u062A',
            address:
              '\u0633\u0627\u0631\u06CC \u062E\u06CC\u0627\u0628\u0627\u0646 \u0645\u0639\u0644\u0645\u060C\u0646\u0628\u0634 \u0645\u0639\u0644\u0645 21',
            type: '\u0645\u0648\u0644\u062A\u06CC \u0628\u0631\u0646\u062F',
            main_area: '\u0645\u0639\u0644\u0645',
            id: '5795',
            shopcode: '0',
            provinceid: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            phone: '0',
            system_unique_id_column: '',
            ytpeid: '0',
            name: '\u0646\u062C\u0641\u06CC',
            nameid: '0',
            mainareaaid: '0',
          },
          dataProcessed: {
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647': '5795',
            mobile: '9111574458',
            city: '\u0633\u0627\u0631\u06CC',
            shopname: '\u0633\u0627\u0631\u06CC \u0633\u062A',
            address:
              '\u0633\u0627\u0631\u06CC \u062E\u06CC\u0627\u0628\u0627\u0646 \u0645\u0639\u0644\u0645\u060C\u0646\u0628\u0634 \u0645\u0639\u0644\u0645 21',
            shopcode: '0',
            province: '\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646',
            name: '\u0646\u062C\u0641\u06CC',
          },
          showData:
            '\u0634\u0646\u0627\u0633\u0647 \u0634\u0631\u06A9\u062A \u06A9\u0646\u0646\u062F\u0647\t:\t5795\r\nmobile\t:\t9111574458\r\ncity\t:\t\u0633\u0627\u0631\u06CC\r\nshopname\t:\t\u0633\u0627\u0631\u06CC \u0633\u062A\r\naddress\t:\t\u0633\u0627\u0631\u06CC \u062E\u06CC\u0627\u0628\u0627\u0646 \u0645\u0639\u0644\u0645\u060C\u0646\u0628\u0634 \u0645\u0639\u0644\u0645 21\r\nshopcode\t:\t0\r\nprovince\t:\t\u0645\u0627\u0632\u0646\u062F\u0631\u0627\u0646\r\nname\t:\t\u0646\u062C\u0641\u06CC',
          filled: false,
          isTempVoter: false,
          hasVote: false,
          allocationStatusBaseType: 0,
          allocationStatusTitle: null,
          comment: null,
          callTime: null,
          allocationStartDate: '2026-07-30T08:00:00',
          allocationEndDate: null,
          lat: null,
          lon: null,
        },
      },
      targetUrl: null,
      success: true,
      error: null,
      unAuthorizedRequest: false,
      __abp: true,
    });
  }
}
