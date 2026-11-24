import { Component, Inject, Injector, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { QuestionModel } from '@core/models/QuestionModel';
import { NgForm } from '@angular/forms';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';

@Component({
  standalone: false,
  templateUrl: './section-dialog.component.html',
  styles: [
    `
      .not-exist-any-item {
        text-align: center;
        min-height: 40vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class SectionDialogComponent extends VoteBaseComponent implements OnInit {
  parent: QuestionModel;
  sectionQuestions: QuestionModel[] = [];
  formSectionUniqueId: string;
  title?: string;
  notFoundAnyQuestion = false;
  saving = false;
  constructor(
    private dialogRef: MatDialogRef<SectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: { parent: QuestionModel; formSectionUniqueId: string },
    injector: Injector,
  ) {
    super(injector);
    this.parent = data.parent;
    this.title = this.parent.title;
    this.formSectionUniqueId = data.formSectionUniqueId;
  }

  async ngOnInit(): Promise<void> {
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');

    // find section
    let section = this.vote.sections.find((x) => x.uniqueId == this.formSectionUniqueId && x.isPopUp);
    if (section) {
      this.sectionQuestions = this.vote.questionList.filter(
        (x) => x.formSectionUniqueId == this.formSectionUniqueId && !x.parentUniqueId && x.isActive,
      );
    }
    this.notFoundAnyQuestion =
      this.sectionQuestions.filter(
        (x) => !x.dontShow && !x.endForm && x.hasVisibleQuestionOrOption && !x.parentUniqueId && x.isActive,
      ).length == 0;
    // if (this.sectionQuestions.length > 0) {
    //   await this.logicService.runFormula(this.sectionQuestions[0].id);
    // }
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

  async ok(form: NgForm, checkFormIsValid = true): Promise<void> {
    if (form.invalid && checkFormIsValid) {
      this.notify.warning(this.translateService.instant('CompleteFormInformationCorrectly'));
      form.control.markAllAsTouched();
      this.vote.showRequiredFormQuestionValidate = true;
      return;
    }
    this.saving = true;
    for (let q of this.sectionQuestions) {
      let finded = this.vote.questionList.findIndex((x) => x.uniqueId == q.uniqueId);
      if (finded > -1) {
        this.vote.questionList[finded] = q;
      }
    }
    const currentSection = this.vote.sections.find((x) => x.uniqueId == this.formSectionUniqueId);
    if (currentSection) await this.logicService.storeSection(currentSection, true);

    this.dialogRef.close({
      formValid: !form.invalid,
      result: this.sectionQuestions,
    });
    this.saving = false;
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
          this.ok(frm, false);
        }
      });
  }
}
