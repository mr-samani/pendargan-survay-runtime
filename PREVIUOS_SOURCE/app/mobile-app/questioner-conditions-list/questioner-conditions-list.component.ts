import { Component, Injector, OnInit } from '@angular/core';
import { appAnimation } from '@core/animations/routerTransition';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import {
  GetAllQuestionerConditionsOutputDto,
  PagedResultCustomDtoOfGetAllQuestionerConditionsOutputDtoDouble,
} from './questioner-conditions-list.model';
import { AppConsts } from '@core/app-consts';
import { catchError, finalize, map, of } from 'rxjs';

@Component({
  standalone: false,
  templateUrl: './questioner-conditions-list.component.html',
  styleUrls: ['./questioner-conditions-list.component.scss'],
  animations: [appAnimation()],
})
export class QuestionerConditionsListComponent extends MobileAppBaseComponent implements OnInit {
  showSpinner = false;
  questionerConditionsList: PagedResultCustomDtoOfGetAllQuestionerConditionsOutputDtoDouble[] = [];
  itemList: GetAllQuestionerConditionsOutputDto[] = [];
  endOfList = false;
  maxResultCount = 8;
  totalCount: number;
  constructor(injector: Injector) {
    super(injector);
    this.itemList = [];
    this.headerService.headerTitle = this.translateService.instant('QuotationPageOfTheQuestioner');
    this.totalCount = this.questionerConditionsList.length;
    this.onScroll();
  }

  ngOnInit(): void {}

  onScroll() {
    if (this.endOfList) {
      return;
    }
    this.showSpinner = true;

    this.route.params.subscribe((params) => {
      const pollUniqueId = params['pollUniqueId'] || '';
      const object = {
        pollUniqueId,
        filterFields: [],
        skipCount: this.itemList.length,
        maxResultCount: this.maxResultCount,
      };

      this.dataService
        .get(AppConsts.apiBaseUrl + AppConsts.serverApis.questionerConditionsList, object)
        .pipe(
          finalize(() => {}),
          map((response) => {
            this.totalCount = response.result.totalCount;
            return response.result.items;
          }),
          catchError((error) => {
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
            return of(null); //of(new GetVoterFullDetail());
          }),
        )
        .subscribe((x) => {
          this.itemList = [...this.itemList, ...x];
          if (this.itemList.length >= this.totalCount) {
            this.endOfList = true;
          }
          this.showSpinner = false;
        });
    });
  }
}
