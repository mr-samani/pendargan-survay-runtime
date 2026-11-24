import { Component, Injector, Input, OnDestroy, OnInit, ViewChild, ViewContainerRef, computed } from '@angular/core';
import { VoteBaseComponent } from '../../vote-base.component';
import { AppConsts } from '@core/app-consts';
import { QuestionModel } from '@core/models/QuestionModel';
import { ControlContainer, NgForm } from '@angular/forms';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import 'orderby-ts';
import { EventEnum } from '@core/models/enums';
@Component({
  standalone: false,
  selector: 'element-builder',
  templateUrl: './element-builder.component.html',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: NgForm,
    },
  ],
})
export class ElementBuilder extends VoteBaseComponent implements OnInit, OnDestroy {
  @Input() item!: QuestionModel;
  @Input() isMatrix = false;
  isMobile = AppConsts.isMobile;
  @ViewChild('dynamicComponentRef', { read: ViewContainerRef, static: true }) dynamicComponentRef?: ViewContainerRef;

  disableQuestionByTimer = false;
  constructor(
    private viewContainerRef: ViewContainerRef,
    injector: Injector,
  ) {
    super(injector);
  }

  async ngOnInit(): Promise<void> {
    if ([FormQuestionTypesEnum.Chart].indexOf(this.item.questionType) > -1) {
      await this.importLazyloadComponent();
    }
    app.event.on(EventEnum.TriggerEndOfTimerCounter + this.item.uniqueId, () => (this.disableQuestionByTimer = true));
  }

  ngOnDestroy(): void {
    if (this.dynamicComponentRef) {
      this.dynamicComponentRef.clear();
    }
  }

  /**
   * پرسش هایی که نیاز به لود کردن لایبرری خاصی هستند باید داینامیک به صفحه اضاف شوند
   * و در لود اولیه وجود نداشته باشند
   */
  async importLazyloadComponent() {
    switch (this.item.questionType) {
      case FormQuestionTypesEnum.Chart:
        const { ChartQuestionComponent } = await import('../chart/chart.component');
        if (this.dynamicComponentRef) {
          this.dynamicComponentRef.clear();
        }
        const chartCompRef = this.viewContainerRef.createComponent(ChartQuestionComponent);
        chartCompRef.instance.item = this.item;
        break;
      //...
    }
  }

  getQuestionWasDisabled = computed(() => {
    // بعد از پرداخت پرسش های قبل از آن باید غیر فعال شوند
    let payQuestions = this.vote.disablePreviousQuestionRowNumber();
    payQuestions = payQuestions?.orderBy((s) => s.rowNumber, 'ASC');
    if (payQuestions.length == 0) {
      return false;
    }
    // اولین پرسش پرداخت بعد از ین پرسش
    let finded = payQuestions.find((x) => x.rowNumber > this.item.rowNumber);
    if (!finded) {
      return false;
    }
    return this.item.rowNumber < finded.rowNumber;
  });
}
