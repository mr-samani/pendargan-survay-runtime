import { Component, Injector, OnInit } from '@angular/core';
import { appAnimation } from '@core/animations/routerTransition';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { DynamicDataProcessed, LoadPollListInputDto } from './allocation-list.model';
import { KeyValue } from '@angular/common';
import { AllocationStatusBaseTypeEnum } from '@app/vote/allocation/allocation.model';
import { AppConsts } from '@core/app-consts';
import { finalize, skip } from 'rxjs';
import { DateTime } from 'luxon';
import { cloneDeep } from 'lodash-es';
import { normalizeText } from '@core/helper/normalize-text';

@Component({
  standalone: false,
  templateUrl: './allocation-list.component.html',
  styleUrls: ['./allocation-list.component.scss'],
  animations: [appAnimation()],
})
export class AllocationListComponent extends MobileAppBaseComponent implements OnInit {
  allAllocationList: DynamicDataProcessed[] = [];
  itemList: DynamicDataProcessed[] = [];
  endOfList = false;
  maxResultCount = 10;
  skipCount = 0;
  totalCount: number = 0;
  filterParam = '';

  allDbDataForSearch: DynamicDataProcessed[] = [];
  constructor(injector: Injector) {
    super(injector);
    this.itemList = [];
    this.headerService.headerTitle = this.translateService.instant('AllocationPageTitle');
    this.allAllocationList = this.route.snapshot.data['data'] ?? [];
    this.allDbDataForSearch = cloneDeep(this.allAllocationList);
  }

  ngOnInit(): void {
    // جدید ها بالا باشند
    this.allAllocationList = this.allAllocationList.sort((a, b) => {
      if (
        (+a.allocationStatusBaseType == 0 ||
          a.allocationStatusBaseType == AllocationStatusBaseTypeEnum.NewAllocation) &&
        +b.allocationStatusBaseType != 0 &&
        b.allocationStatusBaseType != AllocationStatusBaseTypeEnum.NewAllocation
      )
        return -1;
      else return 0;
    });
    this.totalCount = this.allAllocationList.length;
    this.onScroll();
  }

  public get AllocationStatusBaseTypeEnum(): typeof AllocationStatusBaseTypeEnum {
    return AllocationStatusBaseTypeEnum;
  }

  onScroll() {
    if (this.endOfList) {
      return;
    }
    this.skipCount = this.itemList.length;
    this.maxResultCount = this.itemList.length + this.maxResultCount;
    this.itemList = [...this.itemList, ...this.allAllocationList.slice(this.skipCount, this.maxResultCount)];
    // console.log(this.skipCount, this.maxResultCount, this.itemList);
    if (this.totalCount <= this.itemList.length) {
      this.endOfList = true;
    }
  }
  openDetails(item: DynamicDataProcessed) {
    if (item.filled) {
      return;
    }
    let now = DateTime.now();
    if (item.allocationStartDate && DateTime.fromISO(item.allocationStartDate) > now) {
      this.alert.show({
        title: this.translateService.instant('OutOfTimeConsideration'),
        text: this.translateService.instant('StartExpirationError'),
        confirmButtonText: this.translateService.instant('Ok'),
      });
      return;
    }
    if (item.allocationEndDate && DateTime.fromISO(item.allocationEndDate) < now) {
      this.alert.show({
        title: this.translateService.instant('OutOfTimeConsideration'),
        text: this.translateService.instant('EndExpirationError'),
        confirmButtonText: this.translateService.instant('Ok'),
      });
      return;
    }

    let queryParams = this.route.snapshot.queryParams;
    if (queryParams['onIdCodeClick'] == 'true') {
      this.mainSpinnerService.showLoading = true;
      const input = new LoadPollListInputDto();
      input.idCode = item.id;
      input.dynamicDataId = queryParams['dynamicDataId'];
      input.openPollList = queryParams['openPollList'] == 'true';
      input.pollUniqueId = queryParams['pollUniqueId'];
      input.pollId = queryParams['pollId'];
      this.dataService
        .post(AppConsts.hybridUrl + AppConsts.pwaUrls.onIdCodeClick, input)
        .pipe(finalize(() => (this.mainSpinnerService.showLoading = false)))
        .subscribe();
    } else {
      this.router.navigate(['/'], {
        queryParams: {
          idCode: item.id,
        },
      });
    }
  }

  // Preserve original property order
  originalOrder = (a: KeyValue<string, string>, b: KeyValue<string, string>): number => {
    return 0;
  };

  search() {
    try {
      this.itemList = [];
      this.endOfList = false;
      this.skipCount = 0;
      if (this.filterParam) {
        this.allAllocationList = this.allDbDataForSearch.filter((x) => {
          if (!x.dataProcessed || typeof x.dataProcessed !== 'object') {
            x.dataProcessed = {};
          }
          let found = false;
          const normalizeFilterParam = normalizeText(this.filterParam.toLowerCase());
          if (x.id.includes(normalizeFilterParam)) {
            found = true;
          }
          for (let value of Object.values(x.dataProcessed)) {
            const normalizeValue = normalizeText(value.toLowerCase());
            if (normalizeValue.includes(normalizeFilterParam)) {
              found = true;
              break;
            }
          }
          return found;
        });
      } else {
        this.allAllocationList = this.allDbDataForSearch;
      }
      this.onScroll();
    } catch (error) {
      this.allAllocationList = this.allDbDataForSearch;
      this.onScroll();
      console.error('Error on Search Allocation!', error);
    }
  }
}
