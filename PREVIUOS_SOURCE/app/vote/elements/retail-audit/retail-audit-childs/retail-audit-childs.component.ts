import { Component, Inject, Injector, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { AppConsts } from '@core/app-consts';
import { QuestionModel } from '@core/models/QuestionModel';
import { cloneDeep } from 'lodash-es';
import { NgForm } from '@angular/forms';
import { SelectedSkuIteModel } from '@core/models/SelectedSkuIteModel';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';

export interface IRetailAuditDialogData {
  parent: QuestionModel;
  baseQuestions: QuestionModel[];
  skuQuestionChilds: QuestionModel[];
  sku: SelectedSkuIteModel;
}

@Component({
  standalone: false,
  templateUrl: './retail-audit-childs.component.html',
})
export class RetailAuditChildsComponent extends VoteBaseComponent implements OnInit {
  parent: QuestionModel;
  questionChilds: QuestionModel[] = [];
  sku: SelectedSkuIteModel;
  title?: string;
  isMobile = AppConsts.isMobile;

  loading = true;
  constructor(
    private dialogRef: MatDialogRef<RetailAuditChildsComponent>,
    @Inject(MAT_DIALOG_DATA) private data: IRetailAuditDialogData,
    injector: Injector,
  ) {
    super(injector);
    this.questionChilds = data.baseQuestions;
    this.sku = data.sku;
    this.parent = data.parent;
    this.title = this.sku.answerTitle;
    this.setAnswerStates();
  }

  async ngOnInit(): Promise<void> {
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');

    this.vote.showRequiredFormQuestionValidate = false;

    // console.time('init-retail-audit');
    this.loading = true;
    await this.logicService.resetQuestionsInSection(this.parent.formSectionUniqueId);
    await this.logicService.resetFormulaResultInCurrentSection(this.parent.formSectionUniqueId);

    if (this.data.skuQuestionChilds) {
      this.loadAnswers(this.data.skuQuestionChilds);
    }

    if (this.questionChilds.length > 0) {
      await this.logicService.runFormula(this.questionChilds[0].uniqueId);
    }
    this.loading = false;
    // console.timeEnd('init-retail-audit');
  }

  loadAnswers(savedQuestionData: QuestionModel[]) {
    for (let saved of savedQuestionData) {
      this.setAnswer(saved, this.questionChilds);
      if (saved.questionChilds) {
        for (let savedChild of saved.questionChilds) {
          for (let inner of this.questionChilds) {
            this.setAnswer(savedChild, inner.questionChilds ?? []);
          }
        }
      }
    }

    this.vote.showRequiredFormQuestionValidate = true;
    this.logicService.scrollToFirstInvalidControl(this._document.querySelector('.retailAuditDialogContainer'));
  }

  setAnswer(savedQuestion: QuestionModel, questions: QuestionModel[]) {
    let findedQ = questions.find((x) => x.uniqueId == savedQuestion.uniqueId);
    if (findedQ) {
      findedQ.answer = savedQuestion.answer;
      switch (findedQ.questionType) {
        case FormQuestionTypesEnum.UniqueSelect:
        case FormQuestionTypesEnum.Matrix_radio:
        case FormQuestionTypesEnum.Dropdown:
        case FormQuestionTypesEnum.UniqueSelectWithImageOptions:
        case FormQuestionTypesEnum.MultiSelect:
        case FormQuestionTypesEnum.Matrix_checkbox:
        case FormQuestionTypesEnum.Emoji:
        case FormQuestionTypesEnum.MultiSelectWithImageOptions:
        case FormQuestionTypesEnum.HasPriority:
          const ansList: string[] = savedQuestion.answer?.split(',');
          for (let opt of findedQ.questionOptions) {
            opt.selected = ansList.findIndex((x) => x == opt.uniqueId) > -1;
          }
          break;
      }
    }
  }

  setAnswerStates() {
    let dynamicDataColumns = this.sku.jsonValuesDictionary;
    // tslint:disable-next-line: forin
    for (const property in dynamicDataColumns) {
      const dynamicField = this.parent.dynamicDataFields?.find((x) => x.nameSpace === property);
      if (dynamicField) {
        if (dynamicField.isNumeric) {
          this.vote.answerStates['Q' + this.parent.fid + '.Data.' + property] = +dynamicDataColumns[property];
        } else {
          this.vote.answerStates['Q' + this.parent.fid + '.Data.' + property] =
            '"' + dynamicDataColumns[property] + '"';
        }
      }
    }
  }

  cancel(): void {
    this.vote.showRequiredFormQuestionValidate = false;
    this.dialogRef.close();
  }
  ok(form: NgForm): void {
    // if (form.invalid) {
    //   this.notify.warning(this.translateService.instant('CompleteFormInformationCorrectly'));
    //   form.control.markAllAsTouched();
    //   this.vote.showRequiredFormQuestionValidate = true;
    //   return;
    // }
    this.vote.showRequiredFormQuestionValidate = false;
    let isEmpty = this.getAnswerCounts(this.questionChilds) == 0;
    this.dialogRef.close({
      formValid: isEmpty ? undefined : !form.invalid,
      result: cloneDeep(this.questionChilds),
      variables: this.logicService.getVariableAsDictionary(),
    });
  }

  reset(frm: NgForm) {
    this.alert
      .show({
        text: this.translateService.instant('AreYouSureResetForm'),
        showConfirmButton: true,
        showCancelButton: true,
        confirmButtonText: this.translateService.instant('Ok'),
        cancelButtonText: this.translateService.instant('Cancel'),
        allowEnterKey: true,
        allowEscapeKey: true,
        allowOutsideClick: false,
      })
      .then(async (result) => {
        if (result.isConfirmed) {
          await this.logicService.resetQuestionsInSection(this.parent.formSectionUniqueId);
          await this.logicService.resetFormulaResultInCurrentSection(this.parent.formSectionUniqueId);
          frm.reset();
        }
      });
  }

  getAnswerCounts(list: QuestionModel[], count = 0): number {
    for (let item of list) {
      if (item.answer) {
        count++;
      }
      if (item.questionChilds && item.questionChilds.length > 0) {
        count = this.getAnswerCounts(item.questionChilds, count);
      }
    }
    // console.log('sku-count', count);
    return count;
  }
}
