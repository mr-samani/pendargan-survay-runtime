import { AfterViewInit, Component, ElementRef, Injector, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { QuestionModel } from '@core/models/QuestionModel';
import { VoteBaseComponent } from '../../vote-base.component';
import * as Highcharts from 'highcharts';
import { DefaultChartColors } from './default-colors';
import { QuestionChartSetting } from './chart-question.model';
import { AppConsts } from '@core/app-consts';
import { EventEnum } from '@core/models/enums';

import {
  GetDynamicOptionAutoCompleteOutpotDto,
  QuestionJsonDataDto,
} from '@core/models/backend-dto/QuestionJsonDataDto';
import { DynamicOptionAutoCompleteListInputDto } from '@core/models/backend-dto/DynamicOptionAutoCompleteListInputDto';
import { SharedModule } from '@app/shared/shared.module';

@Component({
  selector: 'chart',
  templateUrl: './chart.component.html',
  styles: `
    highcharts-chart {
      display: block;
      max-width: 100%;
    }
  `,
  imports: [SharedModule],
})
export class ChartQuestionComponent extends VoteBaseComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() item!: QuestionModel;
  loading = true;
  Highcharts: typeof Highcharts = Highcharts;
  chartOptions?: Highcharts.Options;
  chart?: Highcharts.Chart;
  chartHeight = 500;
  chartMinWidth = 250;
  categories: string[] = [];
  series: any[] = [];
  @ViewChild('chartContainer') chartContainer!: ElementRef<HTMLDivElement>;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.loadData();
    app.event.on(EventEnum.FilterDynamicDataEvent + this.item.uniqueId, () => {
      this.loadData();
      this.changeDetectorRef.markForCheck();
    });
  }

  ngOnDestroy(): void {
    app.event.off(EventEnum.FilterDynamicDataEvent + this.item.uniqueId);
  }

  ngAfterViewInit(): void {
    const vw = Math.max(this._document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(this._document.documentElement.clientHeight || 0, window.innerHeight || 0);
    if (vw > 500) this.chartMinWidth = 500;
  }

  /**
   * فیلتر بر روی لیست ها برای اتوکامپلیت
   * @param value  عبارت جستجو
   */
  private loadData(): void {
    this.loading = true;
    let dynamicExpression = this.item.fieldValueFilter ?? '';
    const input: DynamicOptionAutoCompleteListInputDto = {
      dynamicDataUniqueId: this.item.dynamicDataUniqueId,
      fieldToSearchIn: dynamicExpression.trim() ? 'DynamicExpression' : '',
      fieldValueFilter: dynamicExpression,
      searchText: '',
      resultsNumber: 1000,
      formGuid: this.vote.formGuid,
      recordIdArrayToGet: undefined,
      searchWithoutSpace: true,
      secondaryFieldToSearchIn: undefined,
      secondaryFieldValueFilter: undefined,
    };
    this.dataService
      .post<GetDynamicOptionAutoCompleteOutpotDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.getDynamicOptionAutoCompleteList,
        input,
      )
      .pipe(
        catchError((error) => {
          this.handleApiError(error, false);
          this.loading = false;
          return of();
        }),
      )
      .subscribe((response) => {
        this.loading = false;
        let result = response.result?.questionJsonDataList ?? [];
        let chartSettingData: QuestionChartSetting[] = Array.isArray(this.item.settings?.chartSetting)
          ? this.item.settings?.chartSetting
          : [];
        let catColumn: string = this.item.settings?.chartCategoryColumn ?? '';
        this.series = [];
        this.categories = [];
        for (let s of chartSettingData) {
          let obj: any = {
            data: [],
            name: s.title,
            type: s.chartType,
          };
          for (const item of result) {
            if (item.jsonValuesDictionary?.[catColumn]) {
              this.categories.push(item.jsonValuesDictionary[catColumn]);
              obj.data.push({
                name: s.title,
                y: +item.jsonValuesDictionary[s.nameSpace],
              });
            }
          }
          this.series.push(obj);
        }
        this.chartOptions = this.setChartOptions();
        Highcharts.chart(this.chartContainer.nativeElement, this.chartOptions);
      });
  }

  chartInstance(ev: Highcharts.Chart) {
    this.chart = ev;
  }

  /**
   * ست کردن تنظیمات نمودار
   * @returns Highcharts.Options
   */
  private setChartOptions(): Highcharts.Options {
    const dir = this.languageService.isRtl ? 'rtl' : 'ltr';
    var self = this;
    return {
      colors: DefaultChartColors,
      responsive: {},
      chart: {
        zooming: {
          type: 'x',
          resetButton: {
            position: {
              align: this.languageService.isRtl ? 'right' : 'left',
            },
          },
        },
        style: {
          ///  direction: dir, highchart has bug for show label xaxis in rtl
          fontFamily: this.languageService.isRtl ? 'iranSans' : '',
        },
      },
      accessibility: {
        enabled: false,
      },
      legend: {
        useHTML: true,
        rtl: this.languageService.isRtl,
      },
      tooltip: {
        useHTML: true,
        style: {
          direction: dir,
          textAlign: this.languageService.isRtl ? 'right' : 'left',
        },
        formatter: function () {
          return (
            '<div>' + this.x + '</div>' + this.series.name + ': <span style="direction:ltr">' + this.y + '</span></br>'
          );
          //+ this.points[1]?.series?.name + ': ' + this.points[1]?.y;
        },
      },
      credits: {
        enabled: false,
      },
      title: {
        useHTML: true,
        text: this.item.settings && this.item.settings.dontShowQuestionTitle ? '' : this.item.title,
        align: 'center',
      },
      subtitle: {
        useHTML: true,
        text: '',
        align: 'center',
      },
      mapNavigation: {
        enableTouchZoom: true,
        enableMouseWheelZoom: true,
      },
      rangeSelector: {
        enabled: true,
      },
      xAxis: {
        title: {
          useHTML: true,
          text: '',
          style: {
            direction: dir,
          },
        },
        labels: {
          useHTML: true,
          style: {
            direction: dir,
          },
        },
        categories: this.categories,
      },
      yAxis: {
        title: {
          useHTML: true,
          text: '',
          style: {
            direction: dir,
          },
        },
      },
      navigation: {
        buttonOptions: {
          enabled: true,
        },
      },
      series: this.series as any,
      plotOptions: {
        // pie: {
        //   dataLabels: {
        //     enabled: true,
        //     formatter: function () {
        //       this.point.name = self.series[this.point.index].name;
        //       return self.series[this.point.index];
        //     },
        //   },
        // },
      },
    };
  }
}
