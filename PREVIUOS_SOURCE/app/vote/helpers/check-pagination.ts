import { QuestionModel } from '@core/models/QuestionModel';
import { VoteSharedService } from '../services/vote-service';

export class CheckPagination {
  /**
   * بررسی نمایش دکمه صفحه قبل
   * @param vote سرویس اشتراکی داده ها
   * @returns boolean
   */
  public static checkHasPreviousQuestion(vote: VoteSharedService): boolean {
    if (vote.oneQuestionPerPage) {
      return this.chkPrvQuestion(vote, vote.pageOffset);
    } else {
      return this.chkPrvSection(vote, vote.currentSectionPage);
    }
  }
  private static chkPrvQuestion(vote: VoteSharedService, QIndex: number): boolean {
    // if (QIndex <= 0) {
    //     return false;
    // }
    const currentSection = vote.sections[vote.currentSectionPage];
    if (!currentSection.loopNumber) currentSection.loopNumber = 0;

    if (currentSection.hasLoop && currentSection.loopNumber > 0) {
      return true;
    }
    const previousQuestion = CheckPagination.getPreviousQuestion(vote.questionList, QIndex);
    if (!previousQuestion) {
      return false;
    }
    if (
      previousQuestion.dontShow ||
      previousQuestion.endForm ||
      !previousQuestion.isActive ||
      !previousQuestion.hasVisibleQuestionOrOption
    ) {
      return this.chkPrvQuestion(vote, QIndex - 1);
    }
    const section = vote.sections.find((x) => x.uniqueId === previousQuestion.formSectionUniqueId);
    if (section && (section.dontShow || !section.hasVisibleQuestion || section.isPopUp)) {
      const indexOfStartSection = vote.questionList.findIndex((x) => x.uniqueId === section.startFormQuestionUniqueId);
      return this.chkPrvQuestion(vote, indexOfStartSection);
    }
    return true;
  }

  private static chkPrvSection(vote: VoteSharedService, sectionIndex: number): boolean {
    if (vote.sections[sectionIndex] == undefined || vote.sections[sectionIndex].loopNumber == undefined) {
      return false;
    }
    if (sectionIndex <= 0 && vote.sections[sectionIndex].loopNumber <= 0) {
      return false;
    }
    if (vote.sections[sectionIndex].loopNumber > 0) {
      return true;
    }

    let i = sectionIndex > 0 ? sectionIndex - 1 : 0;
    for (i; i < vote.sections.length; i--) {
      if (vote.sections[i].dontShow || !vote.sections[i].hasVisibleQuestion || vote.sections[i].isPopUp) {
        return this.chkPrvSection(vote, sectionIndex - 1);
      }
      const questionList = vote.questionList.filter((x) => x.formSectionUniqueId === vote.sections[i].uniqueId);
      for (const q of questionList) {
        if (!q.parentUniqueId && !q.dontShow && !q.endForm && q.isActive && q.hasVisibleQuestionOrOption) {
          return true;
        }
      }
    }
    return false;
  }
  // ------------------------------------------------------------------------------
  /**
   * بررسی نمایش دکمه صفحه بعد
   * @param vote سرویس اشتراکی داده ها
   * @returns boolean
   */
  public static checkHasNextQuestion(vote: VoteSharedService): boolean {
    if (vote.oneQuestionPerPage) {
      return this.chkNxtQuestion(vote, vote.pageOffset);
    } else {
      return this.chkNxtSection(vote, vote.currentSectionPage);
    }
  }

  private static chkNxtQuestion(vote: VoteSharedService, QIndex: number): boolean {
    let nextQuestion: QuestionModel | undefined;
    const currentSection = vote.sections.find((x) => x.uniqueId === vote.questionList[QIndex].formSectionUniqueId);
    // اگر آخرین سوال سکشن جاری بود و سکشن تکرار داشت سوال بعدی می شود اولین سوال همین سکشن
    if (currentSection?.hasLoop && vote.questionList[QIndex].uniqueId === currentSection.endFormQuestionUniqueId) {
      nextQuestion = vote.questionList.find((x) => x.uniqueId === currentSection.startFormQuestionUniqueId);
    } else {
      nextQuestion = CheckPagination.getNextQuestion(vote.questionList, QIndex);
    }

    const section = vote.sections.find((x) => x.uniqueId === nextQuestion?.formSectionUniqueId);
    if (!section || !nextQuestion) {
      return false;
    }
    if (
      nextQuestion.dontShow ||
      nextQuestion.endForm ||
      !nextQuestion.isActive ||
      !nextQuestion.hasVisibleQuestionOrOption
    ) {
      return this.chkNxtQuestion(vote, QIndex + 1);
    }
    if (section.dontShow || !section.hasVisibleQuestion || section.isPopUp) {
      const indexOfEndSection = vote.questionList.findIndex((x) => x.uniqueId === section.endFormQuestionUniqueId);
      return this.chkNxtQuestion(vote, indexOfEndSection);
    }
    return true;
  }
  private static chkNxtSection(vote: VoteSharedService, sectionIndex: number): boolean {
    if (!vote.sections[sectionIndex]) return false;

    if (vote.sections[sectionIndex].hasLoop && !vote.sections[sectionIndex].dontShow) {
      return true;
    }
    if (sectionIndex === vote.sections.length - 1) {
      return false;
    }
    let i = sectionIndex + 1;
    for (i; i < vote.sections.length; i++) {
      if (vote.sections[i].dontShow || !vote.sections[i].hasVisibleQuestion || vote.sections[i].isPopUp) {
        return this.chkNxtSection(vote, sectionIndex + 1);
      }
      const questionList = vote.questionList.filter((x) => x.formSectionUniqueId === vote.sections[i].uniqueId);
      for (const q of questionList) {
        if (!q.parentUniqueId && !q.dontShow && !q.endForm && q.isActive && q.hasVisibleQuestionOrOption) {
          return true;
        }
      }
    }
    return false;
  }

  // ##############################################################################

  private static getNextQuestion(questionList: QuestionModel[], QIndex: number): QuestionModel | undefined {
    let q = questionList[QIndex + 1];
    if (!q) {
      return undefined;
    }
    if (q.parentUniqueId) {
      return this.getNextQuestion(questionList, QIndex + 1);
    } else {
      return q;
    }
  }
  private static getPreviousQuestion(questionList: QuestionModel[], QIndex: number): QuestionModel | undefined {
    let q = questionList[QIndex - 1];
    if (!q) {
      return undefined;
    }
    if (q.parentUniqueId) {
      return this.getNextQuestion(questionList, QIndex - 1);
    } else {
      return q;
    }
  }
}
