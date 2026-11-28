import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { EventEnum, HasDescriptionTypeEnum } from '@core/models/enums';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { ExpressionTargetsEnum } from '@core/models/backend-dto/ExpressionTargetsEnum';
import { ExpressionActionsEnum } from '@core/models/backend-dto/ExpressionActionsEnum';
import { FormExpressionTypeEnum } from '@core/models/backend-dto/FormExpressionTypeEnum';
import { DynamicDataFieldTypeEnum } from '@core/models/backend-dto/DynamicDataFieldTypeEnum';
import { DynamicDataFieldTypeDto } from '@core/models/backend-dto/DynamicDataFieldTypeDto';
import { GetDemographyDataForViewOutputDto } from '@core/models/backend-dto/GetDemographyDataForViewOutputDto';
import { GetFormSectionDto } from '@core/models/backend-dto/GetFormSectionDto';
import { GetFormExpressionDto } from '@core/models/backend-dto/GetFormExpressionDto';
import { AnswerModel } from '@core/models/AnswerModel';
import { QuestionModel } from '@core/models/QuestionModel';
import { SectionSaveModel } from '@core/models/SectionSaveModel';
import { SectionModel } from '@core/models/SectionModel';
import { validationAdditionalSettings } from '../helpers/additional-settings-validate';
import { CheckPagination } from '../helpers/check-pagination';
import { VoteSharedService } from './vote-service';
import { cloneDeep, result } from 'lodash-es';
import { MatrixRandomizePipe } from '@core/pipe/randomize-matrix.pipe';
import { ArrayRandomizePipe } from '@core/pipe/randomize.pipe';
import { ArraySortPipe } from '@core/pipe/array-sort.pipe';
import { AppConsts } from '@core/app-consts';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { VoteThemeService } from './theme.service';
import { getGatewayLogoFileName } from '@core/helper/logo';
import { ConverterDataService } from './converter-data.service';
import { StripHtmlPipe } from '@core/pipe/strip-html.pipe';
import { ExpEvaluator } from '../helpers/expression-evaluator';
import { cleanUpFormula, replaceReplaceAllFunction, splitFormulaBySpace } from '../helpers/formula.helper';

import { FormGlobalVariableTypeEnum } from '@core/models/backend-dto/FormGlobalVariableTypeEnum';
import { GlobalVariableModel } from '@core/models/GlobalVariableModel';
import { FormulaModel } from '@core/models/FormulaModel';
import { TenantPaymentGatewayListModel } from '@core/models/TenantPaymentGatewayListModel';

@Injectable()
export class LogicService {
  pages: SectionSaveModel[] = [];
  localDbName = 'pages';
  expEvaluator = new ExpEvaluator();
  /**
   * آیا این یک فرم خرده فروشی است؟
   */
  isRetailForm: boolean = false;

  constructor(
    private notify: ToastrService,
    private vote: VoteSharedService,
    private translateService: TranslateService,
    private themeService: VoteThemeService,
    private converterDataService: ConverterDataService,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  async createSectionsByQuestionList(sections: GetFormSectionDto[]): Promise<void> {
    if (this.vote.questionList.length === 0) {
      return;
    }
    this.vote.sections = [];
    const uniqueSectionIds = [...new Set(this.vote.questionList.map((item) => item.formSectionUniqueId))];
    for (let s of uniqueSectionIds) {
      let findedSection = sections.find((x) => x.uniqueId == s);
      const q = this.vote.questionList.filter((x) => x.formSectionUniqueId == s && !x.parentUniqueId);
      const firstQ = q[0];
      const lastQ = q[q.length - 1];
      if (findedSection && q.length > 0) {
        const startSectionQuestionId = firstQ.uniqueId;
        const startSectionQuestionRowNumber = firstQ.rowNumber ?? 0;
        const endSectionQuestionId = lastQ.uniqueId;
        const endSectionQuestionRowNumber = lastQ.rowNumber ?? 0;
        this.vote.sections.push({
          title: findedSection.title,
          isPopUp: findedSection.isPopUp,
          startFormQuestionUniqueId: startSectionQuestionId,
          sartQuestionPriority: startSectionQuestionRowNumber,
          endFormQuestionUniqueId: endSectionQuestionId,
          endQuestionPriority: endSectionQuestionRowNumber,
          hasLoop: false,
          loopNumber: 0,
          formUniqueId: findedSection.formUniqueId,
          dontShow: false,
          hasVisibleQuestion: true,
          uniqueId: findedSection.uniqueId,
          uniqueIdPerForm: findedSection.uniqueIdPerForm,
        });
        // // // dont load popup questions in main form
        // // if (findedSection.isPopup) {
        // //     q.map(x => x.parentId = -1);
        // // }
      } else {
        if (!findedSection) console.error('section of question not exist in form!', 'sectionId=', s);
        if (!q) console.error('first question of section not found!', 'sectionId=', s);
      }
    }

    //  console.log(this.vote.sections);
  }

  async initializeQuestions(questions: QuestionModel[]): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // مرتب کردن پرسش ها بر اساس اولویت
        questions.sort((a, b) => {
          const sk = a.sortKey - b.sortKey;
          if (sk !== 0) return sk;

          return (a.childSortKey ?? 0) - (b.childSortKey ?? 0);
        });

        this.vote.questionList = [];
        //retail audit questions
        const retailAuditParentQuestionList = questions.filter(
          (x) => x.isActive && x.questionType == FormQuestionTypesEnum.RetailAudit,
        );
        // هر فرم فقط یک مورد پرسش ریتیل می تواند داشته باشد
        if (retailAuditParentQuestionList.length > 1) {
          reject(new Error('more than one retail audit question exist'));
          return;
        } else if (retailAuditParentQuestionList.length == 1) {
          this.isRetailForm = true;
          const retailAuditQuestion = retailAuditParentQuestionList[0];
          retailAuditQuestion.matrixParts = 1;
          retailAuditQuestion.selectedList = [];
          const retailQuestions = questions.filter(
            (x) =>
              x.isActive &&
              x.formSectionUniqueId == retailAuditQuestion.formSectionUniqueId &&
              x.uniqueId !== retailAuditQuestion.uniqueId &&
              !x.parentUniqueId,
          );
          for (let r of retailQuestions) {
            r.parentUniqueId = retailAuditQuestion.uniqueId;
            r.partId = 1;
          }
        }

        let rowNumber = 1;
        let k = 1;
        for (let item of questions) {
          if (item.isActive === false) {
            continue;
          }
          item = new QuestionModel(item);
          // TODO: skip captcha,voice question in offline mobile app
          if (AppConsts.isMobile) {
            if ([FormQuestionTypesEnum.Captcha, FormQuestionTypesEnum.VoiceRecord].indexOf(item.questionType) > -1) {
              continue;
            }
            // TODO: skip  sent otp code for mobile and email
            if (item.hasVerification) {
              item.hasVerification = false;
            }
          }
          // TODO: create helper funtion GetInitValueForAnswer(item)
          item.answer = '';
          item.settings = validationAdditionalSettings(item.questionType, item.settings);
          if (item.questionOptions) {
            item.questionOptions.forEach((o) => {
              o.settings = validationAdditionalSettings(item.questionType, o.settings);
            });
            item.questionOptions = new ArraySortPipe().transform(item.questionOptions, 'rowNumber');
            if (item.isRandomizeAnswers) {
              item.questionOptions = new ArrayRandomizePipe().transform(
                item.questionOptions,
                true,
                item.randomizeLastOptionsExclusionCount,
              );
            }
          }
          if (!item.isHTML && item.questionType !== FormQuestionTypesEnum.HtmlFrame) {
            item.title = new StripHtmlPipe().transform(item.title);
          }

          if ([FormQuestionTypesEnum.PointQuestion].indexOf(item.questionType) > -1) {
            item.minimumAnswer = item.minimumAnswer ? +item.minimumAnswer : 0;
            item.maximumAnswer = item.maximumAnswer ? +item.maximumAnswer : 100;
            item.answer = item.answer ? +item.answer : item.minimumAnswer;
          }

          // تایمر برای پرسش های پاسخ پویا که تیک عدم نمایش بدنه پرسش خورده باشد امکان پذیر نیست
          if (
            item.questionType == FormQuestionTypesEnum.DynamicAnswer ||
            item.questionType == FormQuestionTypesEnum.RecordsOtherForms
          ) {
            if (item.settings.hasTimer && item.settings.dontShowAutoComplete) {
              item.settings.hasTimer = false;
            }
          }

          if (!item.parentUniqueId) {
            item.rowNumber = rowNumber;
            // این پرسش ها نباید شماره داشته باشند
            if (
              [FormQuestionTypesEnum.HtmlFrame, FormQuestionTypesEnum.Chart, FormQuestionTypesEnum.Group].indexOf(
                item.questionType,
              ) > -1
            ) {
              item.manualCode = '';
            } else {
              item.manualCode = k.toString();
              k++;
            }
            rowNumber++;
            this.vote.questionList.push(item);
          }

          // initialize question group
          if (item.questionType == FormQuestionTypesEnum.Group) {
            const groupChilds = questions.filter((x) => x.parentUniqueId == item.uniqueId);
            for (let child of groupChilds) {
              child.parentUniqueId = undefined;
            }
            const ids = groupChilds.map((x) => x.uniqueId).join(',');
            item.answer = ids;
            item.description = ids;
            item.dontShow = true;
          } else if (
            item.questionType === FormQuestionTypesEnum.Matrix ||
            item.questionType === FormQuestionTypesEnum.Matrix_Dynamic ||
            item.questionType === FormQuestionTypesEnum.RetailAudit
          ) {
            let childQuestions = questions
              .filter((x) => x.parentUniqueId === item.uniqueId)
              .map((m) => new QuestionModel(m));
            //پرسش های ماتریس معمولی به صورت تصادفی نمایش داده شوند
            if (item.isRandomizeMatrixQuestions) {
              childQuestions = new MatrixRandomizePipe().transform(childQuestions, true, item.matrixParts);
            }
            for (let j = 0; j < childQuestions.length; j++) {
              childQuestions[j].rowNumber = rowNumber;

              // در ماتریس ها نباید هیچ فرزندی غیر فعال باشد
              if (
                item.questionType === FormQuestionTypesEnum.Matrix ||
                item.questionType === FormQuestionTypesEnum.Matrix_Dynamic
              ) {
                childQuestions[j].isActive = true;
              }

              // if (item.isActive === false) {
              //     childQuestions[j].isActive = false;
              // }
              childQuestions[j].manualCode = item.manualCode + '-' + (j + 1).toString();
              if (
                [
                  FormQuestionTypesEnum.ShortText,
                  FormQuestionTypesEnum.LongText,
                  FormQuestionTypesEnum.DynamicAnswer,
                  FormQuestionTypesEnum.Dropdown,
                  FormQuestionTypesEnum.Date,
                  FormQuestionTypesEnum.Time,
                  FormQuestionTypesEnum.Numeric,
                ].indexOf(childQuestions[j].questionType) > -1
              ) {
                childQuestions[j].size = 3; // matrix dynamic child size large
              }
              rowNumber++;
              this.vote.questionList.push(childQuestions[j]);
            }
          }
        }

        for (const item of this.vote.questionList) {
          if (item.questionType == FormQuestionTypesEnum.Group) {
            continue;
          }
          item.hasVisibleQuestionOrOption = true;
          item.dontShow = false;
          item.endForm = false;
          item.originalTitle = item.title;
          let matchVariables = item.title ? item.title.match(/\[%\w+%\]/g) : null;
          if (matchVariables) {
            this.addQuestionHasVariables(item.uniqueId, matchVariables);
          }
          item.originalDescription = item.description;
          let matchDescVariables = item.description ? item.description.match(/\[%\w+%\]/g) : null;
          if (matchDescVariables) {
            this.addQuestionHasVariables(item.uniqueId, matchDescVariables);
          }

          if (item.initialValue && item.hasInitialValue) {
            item.answer = item.initialValue.startsWith('[%') ? '' : item.initialValue;
            matchVariables = item.initialValue ? item.initialValue.match(/\[%\w+%\]/g) : null;
            if (matchVariables) {
              this.addQuestionHasVariables(item.uniqueId, matchVariables);
            }
          }
          if (item.secondaryFilterValue) {
            matchVariables = item.secondaryFilterValue ? item.secondaryFilterValue.match(/\[%\w+%\]/g) : null;
            if (matchVariables) {
              this.addQuestionHasVariables(item.uniqueId, matchVariables);
            }
          }
          if (!item.selectedCount) {
            item.selectedCount = 0;
          }

          if (
            [FormQuestionTypesEnum.HtmlFrame, FormQuestionTypesEnum.Chart].indexOf(item.questionType) > -1 ||
            item.settings?.hasTimer == true
          ) {
            item.isRequired = false;
          }
          switch (item.questionType) {
            case FormQuestionTypesEnum.UniqueSelect:
            case FormQuestionTypesEnum.Dropdown:
            // case FormQuestionTypesEnum.Matrix:
            case FormQuestionTypesEnum.Matrix_checkbox:
            case FormQuestionTypesEnum.Matrix_radio:
            case FormQuestionTypesEnum.Matrix_MultiNumeric:
            case FormQuestionTypesEnum.Matrix_MultiShortText:
            case FormQuestionTypesEnum.SkuCount:
            case FormQuestionTypesEnum.MultiSelect:
            case FormQuestionTypesEnum.HasPriority:
            case FormQuestionTypesEnum.Emoji:
            case FormQuestionTypesEnum.MultiSelectWithImageOptions:
            case FormQuestionTypesEnum.UniqueSelectWithImageOptions:
              item.questionOptions.forEach((answerItem) => {
                answerItem.selected = false;
                answerItem.originalTitle = answerItem.title;
                matchVariables = answerItem.title ? answerItem.title.match(/\[%\w+%\]/g) : null;
                if (matchVariables) {
                  this.addQuestionHasVariables(item.uniqueId, matchVariables);
                }
              });
              break;
            case FormQuestionTypesEnum.FileUpload:
              /** تبدیل حجم بایت به کیلو بایت */
              /* از کاربر حجم مجاز به کیلو بایت دریافت می شود ولی به بایت در دیتابیس ذخیره می شود */
              if (item.fileUploadSettingDto) {
                item.fileUploadSettingDto.minSize = item.fileUploadSettingDto.minSize
                  ? item.fileUploadSettingDto.minSize / 1024
                  : 0;
                item.fileUploadSettingDto.maxSize = item.fileUploadSettingDto.maxSize
                  ? item.fileUploadSettingDto.maxSize / 1024
                  : 0;
              }
              item.answer = [];
              break;
            // case FormQuestionTypesEnum.Matrix_Dynamic:
            //     item.isRequired = false;
            //     break;
            case FormQuestionTypesEnum.RecordsOtherForms:
              if (item.initialDynamicDataAnswer) {
                if (item.initialDynamicDataAnswer.length == 1) {
                  item.answer = item.initialDynamicDataAnswer[0];
                  item.dontShow = true;
                } else if (
                  item.initialDynamicDataAnswer.length > 0 &&
                  item.settings?.selectLastOptionWhenResultIsMoreThanOnce
                ) {
                  item.answer = item.initialDynamicDataAnswer[item.initialDynamicDataAnswer.length - 1];
                  item.dontShow = true;
                }
              }
              break;
            case FormQuestionTypesEnum.Payment:
              /**
               * پرسش های پرداخت همیشه باید اجباری باشند
               *  چون ممکن است کاربر دو پرسش پرداخت در یک صفحه قرار دهد
               * و با هر پرداخت باید پرسش های قبل از آن غیر فعال شوند و اگر پرداخت را لغو کرد فقط تا پرسش های قبل از پرداخت قبلی باید فعال شون
               */
              item.isRequired = true;
              if (item.formQuestionTenantPaymentGateways) {
                for (let g of item.formQuestionTenantPaymentGateways) {
                  (g as TenantPaymentGatewayListModel).logoFileName = getGatewayLogoFileName(g.gatewayType);
                }
              }
              break;
          }

          if (item.questionType === FormQuestionTypesEnum.HasPriority) {
            item.answer = [];
            if (item.minimumAnswer === undefined) {
              item.minimumAnswer = item.isRequired ? 1 : 0;
            }
            if (!item.maximumAnswer) {
              item.maximumAnswer = item.questionOptions.length;
            }
          }
          await this.generateAnswerStates(item);
          this.checkHasVisibleQuestionOptions(item);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addQuestionHasVariables(questionUniqueId: string, variableList: string[]) {
    if (this.vote.questionsHasVariable[questionUniqueId] == undefined) {
      this.vote.questionsHasVariable[questionUniqueId] = [];
    }
    for (let v of variableList) {
      if (this.vote.questionsHasVariable[questionUniqueId].indexOf(v) == -1) {
        this.vote.questionsHasVariable[questionUniqueId].push(v);
      }
    }
  }

  /**
   * تغییر پاسخ های پرسش
   * هنگام تغییرات روی پاسخ پرسشاین متد صدا زده میشود
   * @param question    پرسش
   * @param recalculate      تغییر پاسخ نیاز است فرمول ها مجددا اجرا شوند - default=true
   * @param unloadElement اگر در writeValue فرم تغییر کرده بود نباید خودکار به صفحه بعد برود
   */
  public async changeAnswer(question: QuestionModel, recalculate = true, onLoadElement = false): Promise<void> {
    // console.log('answer changed!', question);

    if (recalculate) {
      await this.runFormula(question.uniqueId);
    }
    /*
     * اگر پرسش دارای گزینه توضیحات بود
     * و نوع توضیحات گزینه انتخابی بود
     * بعد از انتخاب آن گزینه توضیحات نمایش داده شود
     */
    if (question.hasDescription == true) {
      question.showDescription = false;
      if (
        (question.descriptionType == HasDescriptionTypeEnum.AllOptions && question.answer) ||
        (question.descriptionType == HasDescriptionTypeEnum.LastOption &&
          question.questionOptions[question.questionOptions.length - 1]?.selected)
      ) {
        question.showDescription = true;
      } else if (question.descriptionType === HasDescriptionTypeEnum.SelectedOption) {
        for (let opt of question.questionOptions) {
          if (opt.hasDescriptiveAnswer === true && opt.selected === true) {
            question.showDescription = true;
          }
        }
      }
    }
    if (!onLoadElement) {
      await this.autoNextQuestion(question);
    }
    if (this.vote.autoSave) {
      this.converterDataService.autoSaveQuestionAnswer$.next(question);
    }
  }

  /**
   * اگر نمایش هر سوال در یک صفحه بود
   * یا تنظیم رفتن به سوال بعد با پاسخ به اخرین سوال فعال بود
   *  با زدن هر گزینه از پرسش ها باقابلیت تک انتخابی خودکار به صفحه بعد برود
   * @returns
   */
  autoNextQuestion(question: QuestionModel) {
    if (!this.vote.automaticGoToNextPage) {
      return;
    }
    let currentSection = this.vote.sections.find((x) => x.uniqueId == question.formSectionUniqueId);
    const lastQuestionIdInCurrentSection = this.vote.questionList
      .filter(
        (x) =>
          x.hasVisibleQuestionOrOption &&
          x.isActive &&
          !x.endForm &&
          !x.dontShow &&
          x.formSectionUniqueId == currentSection?.uniqueId &&
          x.questionType != FormQuestionTypesEnum.Group,
      )
      .pop()?.uniqueId;
    // اگر پرسش آخرین پرسش از بخش جاری بود و پرسش تک انتخابی بود خودکار به صفحه بعد رود
    if (lastQuestionIdInCurrentSection !== question.uniqueId && !this.vote.oneQuestionPerPage) {
      return;
    }
    if (
      [
        FormQuestionTypesEnum.UniqueSelect,
        FormQuestionTypesEnum.Emoji,
        FormQuestionTypesEnum.Point_NumericScale,
        FormQuestionTypesEnum.NPS,
        FormQuestionTypesEnum.UniqueSelectWithImageOptions,
        FormQuestionTypesEnum.Dropdown,
        FormQuestionTypesEnum.Rating,
        FormQuestionTypesEnum.Date,
        // FormQuestionTypesEnum.DynamicAnswer,
      ].indexOf(question.questionType) == -1 ||
      currentSection?.isPopUp
    ) {
      return;
    }
    if (question.hasDescription == true && question.showDescription) {
      return;
    }
    //  console.log('#radio_Q' + question.fid + '.A' + ansId);
    setTimeout(() => {
      let nextBtn: any = this._document.querySelector('#btnnextpage');
      let currentSelected: Element | null | undefined;
      // is object answer
      if (question.questionType == FormQuestionTypesEnum.DynamicAnswer) {
        // currentSelected = this._document.querySelector('#dy_Q' + question.fid);
      } else {
        const findedAnswer = question.questionOptions?.find((x) => x.uniqueId == question.answer);
        const answerFid = findedAnswer?.fid;
        // is simple answer
        currentSelected = this._document.querySelector(
          '#radio_Q' +
            question.fid +
            '_A' +
            answerFid +
            ',#nps_Q' +
            question.fid +
            '_A' +
            answerFid +
            ',#emoji_Q' +
            question.fid +
            '_A' +
            answerFid +
            ',#rate_Q' +
            question.fid +
            '_A' +
            answerFid +
            ',#img_Q' +
            question.fid +
            '_A' +
            answerFid +
            ',#drpdn_Q' +
            question.fid +
            ',#date_Q' +
            question.fid +
            ',#time_Q' +
            question.fid,
        );
      }
      if (question.questionType == FormQuestionTypesEnum.UniqueSelect) {
        currentSelected = currentSelected?.parentElement;
      }
      if (currentSelected && nextBtn) {
        currentSelected.classList.add('flicker-animation');
        setTimeout(() => {
          if (currentSelected) {
            currentSelected.classList.remove('flicker-animation');
          }
          if (nextBtn) {
            nextBtn.click();
          }
        }, 500);
      }
    }, 20);
  }

  /**
   * تولید حالت های ممکن پاسخ برای یک سوال
   * @param question سوال
   * @returns true/false
   */
  async generateAnswerStates(question: QuestionModel): Promise<boolean> {
    if (question.questionType == FormQuestionTypesEnum.Group) {
      return false;
    }
    let stateHasChanged = false;
    let answerTitle = '';
    let point = 0;
    let selectedCount = 0;
    let answerCount = 0;
    const tempAnswerStates: any = {};

    if (this.vote.lastRegionChildId) {
      tempAnswerStates['Region.UniqueId'] = '"' + this.vote.lastRegionChildId.replace(/-/g, '') + '"';
    } else {
      tempAnswerStates['Region.UniqueId'] = '""';
    }

    switch (question.questionType) {
      // تک اتخابی
      case FormQuestionTypesEnum.UniqueSelect:
      case FormQuestionTypesEnum.Dropdown:
      case FormQuestionTypesEnum.Matrix:
      case FormQuestionTypesEnum.Matrix_radio:
      case FormQuestionTypesEnum.Emoji:
      case FormQuestionTypesEnum.UniqueSelectWithImageOptions:
        selectedCount = 0;
        answerCount = 0;
        for (let item of question.questionOptions) {
          if (!item.dontShow) {
            answerCount++;
          }
          if (item.uniqueId === question.answer && !question.dontShow && !item.dontShow) {
            item.selected = true;
            selectedCount++;
            tempAnswerStates['Q' + question.fid + '.A' + item.fid] = true;
            answerTitle = item.title ?? '';
            point = item.point;
          } else {
            item.selected = false;
            tempAnswerStates['Q' + question.fid + '.A' + item.fid] = false;
          }
        }
        tempAnswerStates['Q' + question.fid + '.AnswerTitle'] = '"' + answerTitle + '"';
        tempAnswerStates['Q' + question.fid + '.Point'] = point;
        tempAnswerStates['Q' + question.fid + '.PointWeigth'] = point * question.grade;
        tempAnswerStates['Q' + question.fid + '.SelectedCount'] = selectedCount;
        tempAnswerStates['Q' + question.fid + '.AnswersCount'] = answerCount;

        break;
      // چند انتخابی
      case FormQuestionTypesEnum.HasPriority:
      case FormQuestionTypesEnum.MultiSelect:
      case FormQuestionTypesEnum.MultiSelectWithImageOptions:
      case FormQuestionTypesEnum.Matrix_checkbox:
        selectedCount = 0;
        answerCount = 0;
        question.questionOptions.forEach((item) => {
          if (!item.dontShow) {
            answerCount++;
          }
          if (item.selected === true && !question.dontShow && !item.dontShow) {
            tempAnswerStates['Q' + question.fid + '.A' + item.fid] = true;
            if (answerTitle.length > 0) {
              answerTitle += ', ';
            }
            selectedCount++;
            answerTitle += item.title;
            point += item.point;
          } else {
            tempAnswerStates['Q' + question.fid + '.A' + item.fid] = false;
          }
        });
        tempAnswerStates['Q' + question.fid + '.AnswerTitle'] = '"' + answerTitle + '"';
        tempAnswerStates['Q' + question.fid + '.Point'] = point;
        tempAnswerStates['Q' + question.fid + '.PointWeigth'] = point * question.grade;
        tempAnswerStates['Q' + question.fid + '.SelectedCount'] = selectedCount;
        tempAnswerStates['Q' + question.fid + '.AnswersCount'] = answerCount;

        question.selectedCount = selectedCount;
        break;
      case FormQuestionTypesEnum.SkuCount:
        let skuSum = 0;
        if (Array.isArray(question.answer)) {
          question.selectedList = question.answer;
          question.selectedList.forEach((s) => {
            skuSum += +s.total;
          });
        } else {
          //  question.selectedList = [];
        }
        tempAnswerStates['Q' + question.fid + '.Sum'] = skuSum;
        break;

      case FormQuestionTypesEnum.Matrix_MultiNumeric:
      case FormQuestionTypesEnum.Matrix_MultiShortText:
        question.answer = '';
        question.questionOptions.forEach((item) => {
          if (!question.dontShow && !item.dontShow) {
            if (item.answerDescription) {
              item.selected = true;
              if (question.questionType === FormQuestionTypesEnum.Matrix_MultiNumeric) {
                tempAnswerStates['Q' + question.fid + '.A' + item.fid + '.Number'] = +item.answerDescription;
              } else {
                tempAnswerStates['Q' + question.fid + '.A' + item.fid + '.Text'] = item.answerDescription;
              }
              if (answerTitle.length > 0) {
                answerTitle += ', ';
                question.answer += ', ';
              }
              question.answer += item.fid;
            } else {
              item.selected = false;
              if (question.questionType === FormQuestionTypesEnum.Matrix_MultiNumeric) {
                tempAnswerStates['Q' + question.fid + '.A' + item.fid + '.Number'] = null;
              } else {
                tempAnswerStates['Q' + question.fid + '.A' + item.fid + '.Text'] = null;
              }
            }
          }
        });
        tempAnswerStates['Q' + question.fid + '.AnswerTitle'] = '"' + answerTitle + '"';
        break;
      case FormQuestionTypesEnum.ShortText:
      case FormQuestionTypesEnum.LongText:
      case FormQuestionTypesEnum.Date:
      case FormQuestionTypesEnum.Time:
      case FormQuestionTypesEnum.Email:
      case FormQuestionTypesEnum.Mobile:
      case FormQuestionTypesEnum.NationalCode:
      case FormQuestionTypesEnum.Phone:
      case FormQuestionTypesEnum.PostalCode:
      case FormQuestionTypesEnum.CustomMaskShortText:
        if (!question.dontShow) {
          tempAnswerStates['Q' + question.fid + '.Text'] = '"' + (question.answer ?? '') + '"';
        } else {
          tempAnswerStates['Q' + question.fid + '.Text'] = '""';
        }
        break;
      // پرسش ها امتیازی
      case FormQuestionTypesEnum.PointQuestion:
      case FormQuestionTypesEnum.Rating:
      case FormQuestionTypesEnum.NPS:
        tempAnswerStates['Q' + question.fid + '.Point'] = question.answer ? +question.answer : 0;
        break;
      // پرسش ها ایمیل / عددی / ساعت / تاریخ
      case FormQuestionTypesEnum.Numeric:
      case FormQuestionTypesEnum.Point_NumericScale:
        if (!question.dontShow) {
          tempAnswerStates['Q' + question.fid + '.Number'] = question.answer ? +question.answer : 0;
          tempAnswerStates['Q' + question.fid + '.AnswerTitle'] = '"' + answerTitle + '"';
        } else {
          tempAnswerStates['Q' + question.fid + '.Number'] = 0;
          tempAnswerStates['Q' + question.fid + '.AnswerTitle'] = '""';
        }
        break;
      case FormQuestionTypesEnum.DynamicAnswer:
      case FormQuestionTypesEnum.RetailAudit:
      case FormQuestionTypesEnum.SkuCount_Dynamic:
      case FormQuestionTypesEnum.Chart:
        if (question.dynamicDataFields) {
          for (let dy of question.dynamicDataFields) {
            // tempAnswerStates['Q' + question.fid + '.Data.' + dy.nameSpace] = '"' + dy.nameSpace + '"';
            // for filter dynamic answer columns
            tempAnswerStates['{{' + 'Q' + question.fid + '.Record.Data.' + dy.nameSpace + '}}'] =
              dy.nameSpace + '.Value';
          }
        }
        break;
      case FormQuestionTypesEnum.RecordsOtherForms:
        if (question.answer && question.answer.jsonValuesDictionary) {
          let dynamicDataColumns = question.answer.jsonValuesDictionary;
          // tslint:disable-next-line: forin
          for (const property in dynamicDataColumns) {
            const dynamicField = question.dynamicDataFields?.find((x) => x.nameSpace === property);
            if (dynamicField) {
              if (dynamicField.isNumeric) {
                this.vote.answerStates['Q' + question.fid + '.Data.' + property] = +dynamicDataColumns[property];
              } else {
                this.vote.answerStates['Q' + question.fid + '.Data.' + property] =
                  '"' + dynamicDataColumns[property] + '"';
              }
            }
          }
        }
        break;

      case FormQuestionTypesEnum.Captcha:
        tempAnswerStates['Q' + question.fid + '.Valid'] = question.answer ?? false;
        break;
    }

    question.point = point;
    question.answerTitle = answerTitle;

    for (const property in tempAnswerStates) {
      if (typeof this.vote.answerStates[property] === undefined) {
        stateHasChanged = true;
        this.vote.answerStates[property] = tempAnswerStates[property];
      } else if (this.vote.answerStates[property] !== tempAnswerStates[property]) {
        this.vote.answerStates[property] = tempAnswerStates[property];
        stateHasChanged = true;
      } else {
        this.vote.answerStates[property] = tempAnswerStates[property];
      }
    }

    // console.log('answerStates', this.vote.answerStates);

    return stateHasChanged;
  }

  /**
   * پر کردن مفادیر متغییر های سراسری
   */
  async calculateGvars(question: QuestionModel): Promise<boolean> {
    let oldResult;
    let gvarsChanged = false;
    for (const itemGvar of this.vote.gvarList) {
      if (itemGvar.formQuestionUniqueId === question.uniqueId) {
        oldResult = itemGvar.result;
        let replacedValue = '';
        try {
          replacedValue = await this.replaceFormulaValues(itemGvar.expression, itemGvar.variables);
          itemGvar.result = this.expEvaluator.evaluate(replacedValue);
          // add variable to answer state
          this.vote.answerStates['[%' + itemGvar.title + '%]'] = '"' + itemGvar.result + '"';
        } catch (err) {
          console.error(
            err,
            'error in gvar: ' +
              itemGvar.title +
              '=>"' +
              itemGvar.expression +
              '", QID:' +
              itemGvar.formQuestionUniqueId,
            ',result=',
            itemGvar.result,
            ',replacedValue=',
            replacedValue,
          );
          itemGvar.result = false;
        }
        if (oldResult !== itemGvar.result) {
          itemGvar.resultUpdated = true;
          gvarsChanged = true;
          await this.setGlobalVariableInInitialValues(itemGvar);
        }
        //  else {
        //   itemGvar.resultUpdated = false;
        // }
        // break;
      }
    }

    return gvarsChanged;
  }

  /**
   * جایگذاری متغییر های سراسری در عنوان پرسش ها و پاسخ ها
   */
  async setGlobalVariableInQuestionTitles(): Promise<void> {
    for (const qv of Object.entries(this.vote.questionsHasVariable)) {
      const question: QuestionModel | undefined = this.vote.questionList.find((q) => q.uniqueId === qv[0]);
      if (!question) {
        continue;
      }
      // for question
      question.title = question.originalTitle ?? '';
      let filteredGvariables = this.vote.gvarList.filter((x) => qv[1].indexOf('[%' + x.title + '%]') > -1);
      for (let variable of filteredGvariables) {
        // console.info(variable.title, variableResult);
        question.title = question.title.split('[%' + variable.title + '%]').join(this.getVariableResult(variable));
      }
      if (
        question.isRequired &&
        question.questionType !== FormQuestionTypesEnum.Matrix_Dynamic &&
        question.questionType !== FormQuestionTypesEnum.Matrix
      ) {
        if (question.title.endsWith('</p>')) {
          if (question.title.includes('<strong class="require-asterisk">*</strong>') == false) {
            question.title = question.title.replace(
              new RegExp('</p>$'),
              '<strong class="require-asterisk">*</strong></p>',
            );
          }
        } else {
          if (question.title.includes('<strong class="require-asterisk">*</strong>') == false) {
            question.title += '<strong class="require-asterisk">*</strong>';
          }
        }
      }
      // آگر بخواهیم متغییرهایی که پیدا نشد را از متن حذف کنیم
      // question.title = question.title.replace(/\[%\w+%\]/g, '');

      // for answers
      question.questionOptions.forEach((a: AnswerModel) => {
        let orgAnsTitle = a.originalTitle ?? '';
        for (let variable of filteredGvariables) {
          orgAnsTitle = orgAnsTitle.split('[%' + variable.title + '%]').join(this.getVariableResult(variable));
        }
        a.title = orgAnsTitle;
        // آگر بخواهیم متغییرهایی که پیدا نشد را از متن حذف کنیم
        // a.title = a.title.replace(/\[%\w+%\]/g, '');
      });
      // for descriptions
      let orgDesc = question.originalDescription ?? '';
      for (let variable of filteredGvariables) {
        orgDesc = orgDesc.split('[%' + variable.title + '%]').join(this.getVariableResult(variable));
      }
      question.description = orgDesc;

      if (question.parentUniqueId) {
        app.event.trigger(EventEnum.UpdateVariableInTitle + question.parentUniqueId, question);
      }
    }
  }

  getVariableResult(variable: GlobalVariableModel) {
    try {
      const defaultImg = 'assets/images/no-image.png';
      const defaultImgAvatar = 'assets/images/avatar.jpg';
      let variableResult: any = '';
      if (typeof variable.result == 'string') {
        variable.result = variable.result.replace(/undefined/g, '');
      }

      switch (variable.type) {
        case FormGlobalVariableTypeEnum.ImageString:
          variableResult =
            isNullOrEmpty(variable.result) == false ? `data:image/png;base64,${variable.result}` : defaultImg;
          break;
        case FormGlobalVariableTypeEnum.ImageProfileFile:
          variableResult =
            isNullOrEmpty(variable.result) == false
              ? AppConsts.profilePictureUrl + '?TenantId=' + AppConsts.tenantId + '&ProfilePictureId=' + variable.result
              : defaultImgAvatar;
          break;
        case FormGlobalVariableTypeEnum.ImageFile:
          if (variable.result) {
            let fileGuidList = JSON.parse(variable.result);
            variableResult =
              fileGuidList.length > 0 && isNullOrEmpty(fileGuidList[0]) == false
                ? AppConsts.fileServerUrl + '/' + fileGuidList[0]
                : defaultImg;
          }
          break;
        case FormGlobalVariableTypeEnum.OtherFile:
          variableResult = !isNullOrEmpty(variable.result) ? variable.result : '';
          break;
        default:
          variableResult =
            '<span class="text-variable">' + (!isNullOrEmpty(variable.result) ? variable.result : '') + '</span>';
          break;
      }
      return variableResult;
    } catch (error) {
      return '';
    }
  }

  /**
   * جایگذاری متغییر های سراسری در عنوان پرسش ها و پاسخ ها
   * و مقدار پیش فرض
   */
  async setGlobalVariableInInitialValues(itemGvar: GlobalVariableModel, isReset = false): Promise<void> {
    for (const qv of Object.entries(this.vote.questionsHasVariable)) {
      const question: QuestionModel | undefined = this.vote.questionList.find((q) => q.uniqueId === qv[0]);
      if (question) {
        qv[1].forEach((vItem: string) => {
          let variableResult = isNullOrEmpty(itemGvar.result) == false ? itemGvar.result : '';
          if (vItem === '[%' + itemGvar.title + '%]') {
            // for initial value
            if (question.initialValue && question.hasInitialValue) {
              const value = question.initialValue.split(vItem).join(variableResult.toString());
              if (value.startsWith('[%') === false) {
                if (question.questionType == FormQuestionTypesEnum.Payment) {
                  if (Number.isInteger(+value)) {
                    question.settings!.amount = +value;
                  } else {
                    question.settings!.amount = 0;
                  }
                } else {
                  question.answer = value;
                }
                question.evaluateInitialValue = value;
              }

              this.changeAnswer(question, false);
            }
            // for secondary filter value in Sku count dynamic
            if (question.secondaryFilterValue) {
              if (
                !isReset &&
                (question.questionType === FormQuestionTypesEnum.SkuCount_Dynamic ||
                  question.questionType === FormQuestionTypesEnum.RetailAudit)
              ) {
                const f = question.secondaryFilterValue.split(vItem).join(variableResult.toString());
                if (f !== question.secondaryFieldValueFilter && !f.startsWith('[%')) {
                  question.secondaryFieldValueFilter = f;
                  app.event.trigger(EventEnum.TriggerSkuDynamicEvent + question.uniqueId, true);
                }
              }
              this.changeAnswer(question, false);
            }
          }
        });
      }
    }
  }

  /**
   * دریافت لیست متغییر های سراسری از سرور
   */
  async initializeGlobalVariables(response: GlobalVariableModel[], queryParams: Params): Promise<void> {
    this.vote.gvarList = [];

    for (var gVarItem of response) {
      // TODO system_initialvalue_dynamicanswer_ این مقدار مربوط به طراحی قدیمی مقدار اولیه برای پاسخ پویا که دیگه وجود نداره- و باید از دیتابیس پاک میشده
      if (gVarItem.isActive && gVarItem.title.includes('system_initialvalue_dynamicanswer_') == false) {
        gVarItem.expression = cleanUpFormula(' ' + gVarItem.expression + ' ');
        gVarItem.resultUpdated = undefined;
        gVarItem.result = undefined;
        gVarItem.variables = splitFormulaBySpace(gVarItem.expression);
        delete gVarItem.designerCode;
        this.vote.gvarList.push(gVarItem);
      }
    }

    // اضافه کردن پارامترهای کوئری استرینگ به متغییرهای سیستمی
    if (queryParams) {
      for (let param of Object.entries(queryParams)) {
        let variableTitle = cleanUpFormula(param[0]);
        let variableResult = cleanUpFormula(param[1]);
        if (this.vote.gvarList.findIndex((x) => x.title === variableTitle) === -1) {
          const newVar = new GlobalVariableModel();
          newVar.title = variableTitle;
          newVar.result = variableResult;
          newVar.isActive = true;
          newVar.isSystemVariable = false;
          newVar.isUserDefined = false;
          newVar.id = this.vote.gvarList.length;
          newVar.formUniqueId = this.vote.pollData.formUniqueId;
          newVar.type = FormGlobalVariableTypeEnum.String;
          newVar.expression = '';
          newVar.variables = [];
          this.vote.gvarList.push(newVar);
        }
      }
    }
  }

  /**
   * دریافت فرمول ها
   */
  async initializeFormula(response: GetFormExpressionDto[]): Promise<void> {
    this.vote.formulaList = response.filter((f) => f.isActive);
    // مرتب سازی فرمول ها TODO
    // this.vote.formulaList.sort((a, b) => {
    //   if (this.vote.getQuestionNumberFromQuestionId(a.formQuestionId) >
    // this.vote.getQuestionNumberFromQuestionId(b.formQuestionId)) return 1;
    //   if (this.vote.getQuestionNumberFromQuestionId(a.formQuestionId) <
    // this.vote.getQuestionNumberFromQuestionId(b.formQuestionId)) return -1;
    //   if (a.isForQuestion && !b.isForQuestion) return 1;
    //   if (!a.isForQuestion && b.isForQuestion) return -1;
    //   if (a.formulaKind > b.formulaKind) return 1;
    //   if (a.formulaKind < b.formulaKind) return -1;
    //   return 0;
    // });
    for (let fItem of this.vote.formulaList) {
      fItem.expressionText = cleanUpFormula('  ' + fItem.expressionText + ' ');
      fItem.result = undefined;
      fItem.expressionReplacedText = undefined;
      fItem.resultUpdated = undefined;
      fItem.variables = splitFormulaBySpace(fItem.expressionText);
    }
  }

  /**
   * پر کردن value های دمو گرافی
   * @param data داده دموگرافی
   */
  initializeDemographicFields(data: GetDemographyDataForViewOutputDto): void {
    this.vote.demographyData = data;
    if (this.vote.demographyData) {
      this.fillFieldValue(this.vote.demographyData.dynamicJsonData);
    }

    if (this.vote.demographyData && this.vote.demographyData.dynamicDataFieldTypeDtos) {
      for (const item of this.vote.demographyData.dynamicDataFieldTypeDtos) {
        if (
          [
            DynamicDataFieldTypeEnum.Integer,
            DynamicDataFieldTypeEnum.Decimal,
            DynamicDataFieldTypeEnum.ID,
            DynamicDataFieldTypeEnum.Lat,
            DynamicDataFieldTypeEnum.Lon,
          ].indexOf(item.dynamicDataField.dynamicDataType.dataType) > -1
        ) {
          this.vote.answerStates['Demography.Data.' + item.dynamicDataField.nameSpace] = +(item.value ?? '');
        } else {
          this.vote.answerStates['Demography.Data.' + item.dynamicDataField.nameSpace] = '"' + item.value + '"';
        }
      }
    }
  }
  initializeSystemDataFields(data: DynamicDataFieldTypeDto[]): void {
    if (data && data.length > 0) {
      for (const item of data) {
        if (
          [
            DynamicDataFieldTypeEnum.Integer,
            DynamicDataFieldTypeEnum.Decimal,
            DynamicDataFieldTypeEnum.ID,
            DynamicDataFieldTypeEnum.Lat,
            DynamicDataFieldTypeEnum.Lon,
          ].indexOf(item.dynamicDataField.dynamicDataType.dataType) > -1
        ) {
          this.vote.answerStates['System.' + item.dynamicDataField.nameSpace] = +(item.value ?? '');
        } else {
          this.vote.answerStates['System.' + item.dynamicDataField.nameSpace] = '"' + item.value + '"';
        }
      }
    }
  }
  /**
   * پر کردن مقادیر در داده های دمو گرافی از روی جیسون داده ها
   */
  private fillFieldValue(jsonValue?: string): void {
    if (!jsonValue || !this.vote.demographyData?.dynamicDataFieldTypeDtos) {
      return;
    }
    const jsonParsed = JSON.parse(jsonValue);
    for (const item of this.vote.demographyData?.dynamicDataFieldTypeDtos) {
      if (item.dynamicDataField.nameSpace) {
        item.value = jsonParsed[item.dynamicDataField.nameSpace];
      }
    }
  }

  /**
   * آپدیت فرمول های این سوال به بعد
   * از این سوال تا سوالی بعدی قابل نمایش یا  تا پایان سکشن بعدی
   * @param formQuestionUniqueId آیدی سوال جاری
   * @param isInit هنگام دریافت سوالات باید یک بار همه پرسش ها بررسی شوند
   */
  async runFormula(formQuestionUniqueId: string, qList?: QuestionModel[], isInit = false): Promise<void> {
    if (!qList) {
      qList = this.vote.questionList;
    }
    const startIndex = qList.findIndex((x) => x.uniqueId === formQuestionUniqueId);
    // در نمایش هر سوال در یک صفحه باید تا دو سوال بعدی را چک کرد
    let checkTwoNextQuestion = 0;
    let i = 0;
    // console.time('runFormula');
    for (i = startIndex; i < qList.length; i++) {
      // console.log('check',i,qList[i].title);
      await this.generateAnswerStates(qList[i]);
      let isChangedGvar = await this.calculateGvars(qList[i]);
      if (isChangedGvar) {
        await this.generateAnswerStates(qList[i]);
      }
      const updatedFormula = await this.calculateFormulas(qList[i].uniqueId);
      if (updatedFormula) {
        await this.updateFormView(qList);
        await this.generateAnswerStates(qList[i]);
        this.triggerUpdateQuestionFormula(qList[i]);
        if (i > 0) {
          i--;
          checkTwoNextQuestion = 0;
          continue;
        }
      }
      // در هنگام لود صفحه همه پرسش ها باید بررسی شوند
      if (isInit) {
        continue;
      }
      // اگر نمایش هر پرسش در یک صفحه بود فقط باید تا پرسش بعدی چک شود
      if (this.vote.oneQuestionPerPage) {
        if (checkTwoNextQuestion === 2) {
          break;
        }
        if (!qList[i + 1]?.dontShow && qList[i + 1]?.hasVisibleQuestionOrOption && qList[i + 1]?.isActive) {
          checkTwoNextQuestion++;
        }
      }
      // بررسی پرسش ها تا آخر سکشن بعدی
      else if (
        this.vote.sections[this.vote.currentSectionPage + 1] &&
        !this.vote.sections[this.vote.currentSectionPage + 1].dontShow &&
        this.vote.sections[this.vote.currentSectionPage + 1].hasVisibleQuestion &&
        !this.vote.sections[this.vote.currentSectionPage + 1].isPopUp &&
        qList[i].uniqueId === this.vote.sections[this.vote.currentSectionPage + 1].endFormQuestionUniqueId
      ) {
        break;
      }
    }

    // console.log('checkedFormulaQuestion', (i - startIndex) + 1);
    await this.setGlobalVariableInQuestionTitles();

    this.vote.showPreviousButton = CheckPagination.checkHasPreviousQuestion(this.vote);

    this.vote.showSubmitButton = !CheckPagination.checkHasNextQuestion(this.vote);
    // console.timeEnd('runFormula');

    this.updateProgressBar();
  }

  /**
   * محاسبه مقادر فرمول ها
   *
   */
  async calculateFormulas(formQuestionUniqueId: string): Promise<boolean> {
    let oldResult;
    let formulaChanged = false;
    let filteredList = this.vote.formulaList.filter(
      (x) =>
        x.isActive &&
        (x.formQuestionUniqueId === formQuestionUniqueId ||
          x.targetType === ExpressionTargetsEnum.Section ||
          x.targetType === ExpressionTargetsEnum.SectionLoop),
    );
    for (const formulaItem of filteredList) {
      oldResult = formulaItem.result;
      // قرار دادن متغییر های سراسری در فرمول
      const newFormula = await this.replaceGvarValues(formulaItem.expressionText ?? '');
      let replacedValue = '';
      try {
        replacedValue = await this.replaceFormulaValues(newFormula, formulaItem.variables);
        if (formulaItem.targetType === ExpressionTargetsEnum.FilterDynamicAnswer) {
          let dynamicAnswerQuestionIndex = this.vote.questionList.findIndex(
            (x) => x.uniqueIdPerForm === formulaItem.targetKey,
          );
          if (dynamicAnswerQuestionIndex > -1) {
            let previousFieldValueFilter = this.vote.questionList[dynamicAnswerQuestionIndex].fieldValueFilter;
            this.vote.questionList[dynamicAnswerQuestionIndex].fieldValueFilter = replacedValue;
            if (previousFieldValueFilter !== replacedValue) {
              app.event.trigger(
                EventEnum.FilterDynamicDataEvent + this.vote.questionList[dynamicAnswerQuestionIndex].uniqueId,
                true,
              );
            }
          }
        } else {
          formulaItem.expressionReplacedText = replacedValue;
          formulaItem.result = this.expEvaluator.evaluate(replacedValue);
          if (formulaItem.result !== true && formulaItem.result !== false) {
            throw new Error('Invalid');
          }
        }
      } catch (err) {
        formulaItem.result = false;
        console.log(
          err,
          'error in formula: "' +
            formulaItem.expressionText +
            '" value=(' +
            replacedValue +
            '), QID:' +
            formulaItem.formQuestionUniqueId +
            ' FormulaId=' +
            formulaItem.uniqueId,
        );
      }

      if (oldResult !== formulaItem.result) {
        formulaItem.resultUpdated = true;
        formulaChanged = true;
      }
    }
    return formulaChanged;
  }

  async replaceGvarValues(formula: string): Promise<string> {
    let newFormula = formula;
    for (const gvarItem of this.vote.gvarList) {
      newFormula = newFormula.replace(
        new RegExp(' \\[%' + gvarItem.title + "%\\] (?!(?=[^']*'[^']*(?:'[^']*'[^']*)*$))", 'ig'),
        ' ' + this.getResult(gvarItem.result) + ' ',
      );
    }
    return newFormula;
  }

  async replaceFormulaValues(formula: string, variablesList?: string[]): Promise<string> {
    let newFormula = formula;
    if (!variablesList) {
      variablesList = [];
    }

    for (const variable of variablesList) {
      if (variable) {
        // if (this.vote.answerStates[variable]) {
        // newFormula = newFormula.replaceAll(' @' + ansState.name + ' ', ansState.value + ' ', true);
        // newFormula = newFormula.replace(/' @' + variable + ' '/g, this.vote.answerStates[variable] + ' ');
        /// todo:check for filter
        if (this.vote.answerStates[variable] === undefined) {
          this.vote.answerStates[variable] = null;
        }
        if (
          (variable.startsWith('[%') && variable.endsWith('%]')) ||
          (variable.startsWith('{{') && variable.endsWith('}}'))
        ) {
          newFormula = replaceReplaceAllFunction(
            newFormula,
            ' ' + variable + ' ',
            ' ' + this.vote.answerStates[variable] + ' ',
            true,
          );
        } else {
          newFormula = replaceReplaceAllFunction(
            newFormula,
            ' @' + variable + ' ',
            ' ' + this.vote.answerStates[variable] + ' ',
            true,
          );
        }

        //  }
      }
    }
    return newFormula;
  }

  getResult(result: string): string {
    if (typeof result === 'string') {
      return '"' + result + '"';
    } else {
      return result;
    }
  }

  public async updateFormView(targetQuestionList: QuestionModel[]): Promise<void> {
    // TODO: performance
    let pollQuotaFormulaInList = this.vote.formulaList
      .filter((formula) => formula.formExpressionType == FormExpressionTypeEnum.PollQuota)
      .sort((a, b) => {
        return a.result === b.result ? 0 : a.result ? 1 : -1;
      });

    for (const formulaItem of pollQuotaFormulaInList) {
      if (formulaItem.isActive) {
        //delete  formulaItem.resultUpdated from if condition for Quota
        await this.fillQuestionAndAnswersCapacity(formulaItem, formulaItem.result);
        formulaItem.resultUpdated = false;
      }
    }

    let insideFormFormulaInList = this.vote.formulaList.filter(
      (formula) => formula.formExpressionType == FormExpressionTypeEnum.InsideForm,
    );
    for (const formulaItem of insideFormFormulaInList) {
      var question = targetQuestionList.find((i) => i.uniqueId == formulaItem.formQuestionUniqueId);

      if (formulaItem.isActive && formulaItem.resultUpdated) {
        if (question && formulaItem.targetType === ExpressionTargetsEnum.Question) {
          await this.showHideQuestion(question, formulaItem.result, formulaItem.actionType);
        } else if (question && formulaItem.targetType === ExpressionTargetsEnum.Answer) {
          await this.showHideAnswer(question, formulaItem.targetKey!, formulaItem.result, formulaItem.actionType);
        } else if (formulaItem.targetType === ExpressionTargetsEnum.Section) {
          await this.showHideSection(formulaItem.targetKey!, formulaItem.result, formulaItem.actionType);
        } else if (formulaItem.targetType === ExpressionTargetsEnum.SectionLoop) {
          await this.setHasSectionLoop(formulaItem.targetKey!, formulaItem.result);
        }
        formulaItem.resultUpdated = false;
      }
    }
  }

  async fillQuestionAndAnswersCapacity(formulaItem: FormulaModel, result: boolean) {
    switch (formulaItem.actionType) {
      //  case ExpressionActionsEnum.Show:
      case ExpressionActionsEnum.Hide:
        let minRemainedCount = -1;
        const question = this.vote.questionList.find((x) => x.uniqueId === formulaItem.formQuestionUniqueId);
        const filteredItems = this.vote.formulaList.filter(
          (x) => x.targetKey === formulaItem.targetKey && x.result === true,
        );
        const reachMaxCount: boolean = filteredItems.filter((x) => x.reachMaxCount).length > 0;
        if (filteredItems.length > 0) minRemainedCount = Math.min(...filteredItems.map((x) => x.remainedCount!));
        if (question) {
          const answer = question.questionOptions.find((x) => x.uniqueIdPerForm == formulaItem.targetKey);
          if (answer) {
            answer.fullQuota = reachMaxCount;
            answer.remainedPercent = formulaItem.remainedPercent;
            answer.remainedCount = minRemainedCount;
            answer.disabled = reachMaxCount;
            if (result && reachMaxCount) {
              answer.selected = false;
              question.saveSuccess = undefined;
              switch (question.questionType) {
                case FormQuestionTypesEnum.UniqueSelect:
                case FormQuestionTypesEnum.Dropdown:
                case FormQuestionTypesEnum.Matrix_radio:
                  if (question.answer == answer.uniqueId) {
                    question.answer = '';
                  }
                  break;
                case FormQuestionTypesEnum.MultiSelect:
                case FormQuestionTypesEnum.Matrix_checkbox:
                  question.answer = question.questionOptions
                    .filter((o) => o.selected)
                    .map((a) => a.uniqueId)
                    .join(',');
                  break;
              }
            }
          }
        }
        break;
      case ExpressionActionsEnum.EndForm:
      case ExpressionActionsEnum.SubmitForm:
        await this.endFormTrigger(formulaItem.formQuestionUniqueId!, result, formulaItem.actionType);
        break;
    }
  }

  /**
   * نمایش یا عدم نمایش سوال
   */
  async showHideQuestion(question: QuestionModel, result: boolean, actionType: ExpressionActionsEnum): Promise<void> {
    if (!question) {
      return;
    }

    switch (actionType) {
      case ExpressionActionsEnum.Show:
        // case ExpressionActionsEnum.Hide:
        result = !result;
        break;
      case ExpressionActionsEnum.EndForm:
      case ExpressionActionsEnum.SubmitForm:
        await this.endFormTrigger(question.uniqueId, result, actionType);
        break;
    }
    if (actionType === ExpressionActionsEnum.Show || actionType === ExpressionActionsEnum.Hide) {
      question.dontShow = result;
    }

    this.checkDouplicateQuestionInMatrix(question);
    this.checkHasVisibleQuestionOptions(question);
  }

  /**
   * نمایس یا عدم نمایش پاسخ
   */
  async showHideAnswer(
    question: QuestionModel,
    answerUniqueIdPerForm: string,
    result: boolean,
    actionType: ExpressionActionsEnum,
  ): Promise<void> {
    if (!question) {
      return;
    }
    const answer = question.questionOptions.find((x) => x.uniqueIdPerForm === answerUniqueIdPerForm);
    if (!answer) {
      return;
    }
    switch (actionType) {
      case ExpressionActionsEnum.Show:
        // case ExpressionActionsEnum.Hide:
        result = !result;
        break;
      case ExpressionActionsEnum.Select:
        if (
          question.questionType === FormQuestionTypesEnum.UniqueSelect ||
          question.questionType === FormQuestionTypesEnum.Dropdown ||
          question.questionType === FormQuestionTypesEnum.Matrix_radio
        ) {
          // اگر شرط انتخاب بر قرار بود
          if (result) {
            question.answer = answer.uniqueId;
            question.questionOptions.forEach((a) => {
              a.selected = false;
              if (a.uniqueId === answer.uniqueId) {
                a.selected = result;
              }
            });
          }
          // اگر شرط انتخاب برقرار نبود
          else {
            if (question.answer == answer.uniqueId) {
              question.answer = undefined;
              question.questionOptions.forEach((a) => (a.selected = false));
            }
          }
        } else if (
          question.questionType === FormQuestionTypesEnum.MultiSelect ||
          question.questionType === FormQuestionTypesEnum.Matrix_checkbox ||
          question.questionType === FormQuestionTypesEnum.HasPriority
        ) {
          question.questionOptions.forEach((a: AnswerModel) => {
            if (a.uniqueId === answer.uniqueId) {
              if (result) {
                a.selected = true;
                a.disabled = true;
              } else if (a.disabled) {
                a.selected = false;
                a.disabled = false;
              }
            }
          });
          let selectedList: string[] = [];
          question.questionOptions.filter((x) => x.selected).forEach((o) => selectedList.push(o.uniqueId));
          question.answer = selectedList.join(',');
        }
        break;
      case ExpressionActionsEnum.UnSelect:
        question.questionOptions.forEach((a: AnswerModel) => {
          if (a.uniqueId === answer.uniqueId) {
            if (result) {
              a.selected = false;
              a.disabled = true;
            } else {
              a.disabled = false;
            }
          }
        });
        break;

      case ExpressionActionsEnum.EndForm:
      case ExpressionActionsEnum.SubmitForm:
        await this.endFormTrigger(question.uniqueId, result, actionType);
        break;
    }

    if (actionType === ExpressionActionsEnum.Show || actionType === ExpressionActionsEnum.Hide) {
      if (result) {
        answer.dontShow = true;
        answer.selected = false;
      } else {
        answer.dontShow = false;
      }
    }
    //بررسی اینکه اگر پاسخ از قبل انتخاب شده بود اگر اکنون پاسخ دیده نمیشد پاسخ پرسش پاک شود
    question.answer = question.questionOptions
      .filter((x) => x.selected)
      .map((m) => m.uniqueId)
      .join(',');
    if (
      question.answer &&
      [FormQuestionTypesEnum.UniqueSelect, FormQuestionTypesEnum.Matrix_radio].indexOf(question.questionType) > -1
    ) {
      question.answer = question.answer;
    }

    this.checkHasVisibleQuestionOptions(question);
  }

  /**
   * نمایش یا عدم نمایش بخش
   */
  async showHideSection(
    formSectionUniqueIdPerForm: string,
    result: boolean,
    actionType: ExpressionActionsEnum,
  ): Promise<void> {
    const sectionIndex = this.vote.sections.findIndex((x) => x.uniqueIdPerForm === formSectionUniqueIdPerForm);
    if (sectionIndex > -1) {
      if (actionType === ExpressionActionsEnum.Show) {
        this.vote.sections[sectionIndex].dontShow = !result;
      } else if (actionType === ExpressionActionsEnum.Hide) {
        this.vote.sections[sectionIndex].dontShow = result;
      }
    }
  }
  /**
   * سکشن دارای تکرار هست یا خیر
   */
  async setHasSectionLoop(formSectionUniqueIdPerForm: string, result: boolean): Promise<void> {
    const sectionIndex = this.vote.sections.findIndex((x) => x.uniqueIdPerForm === formSectionUniqueIdPerForm);
    if (sectionIndex > -1) {
      this.vote.sections[sectionIndex].hasLoop = result;
    }
  }

  /**
   * اگر کل گزینه های پرسش مخفی شد خود پرسش هم دیده نشود
   */
  checkHasVisibleQuestionOptions(question: QuestionModel): void {
    // سوالات گزینه دار
    if (
      [
        FormQuestionTypesEnum.UniqueSelect,
        FormQuestionTypesEnum.MultiSelect,
        FormQuestionTypesEnum.Dropdown,
        FormQuestionTypesEnum.Matrix_checkbox,
        FormQuestionTypesEnum.Matrix_radio,
        FormQuestionTypesEnum.UniqueSelectWithImageOptions,
        FormQuestionTypesEnum.MultiSelectWithImageOptions,
        FormQuestionTypesEnum.Emoji,
      ].indexOf(question.questionType) > -1 &&
      question.dontShow !== true &&
      question.questionOptions.length > 0
    ) {
      let hasVisibleOption = false;
      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < question.questionOptions.length; i++) {
        if (question.questionOptions[i].dontShow === false || question.questionOptions[i].dontShow === undefined) {
          hasVisibleOption = true;
          break;
        }
      }
      question.hasVisibleQuestionOrOption = hasVisibleOption;
    }

    // if is Matrix Question
    if (question.parentUniqueId) {
      // parent question
      const parentQuestion = this.vote.questionList.find((x) => x.uniqueId === question.parentUniqueId);
      if (parentQuestion) {
        parentQuestion.hasVisibleQuestionOrOption = false;
        const questionChild = this.vote.questionList.filter((x) => x.parentUniqueId === parentQuestion.uniqueId);
        for (const qItem of questionChild) {
          if (qItem.isActive && !qItem.dontShow && qItem.hasVisibleQuestionOrOption) {
            parentQuestion.hasVisibleQuestionOrOption = true;
            break;
          }
        }
      }
    }

    this.setSectionHasVisibleQuestion(question.formSectionUniqueId);
  }
  /**
   * check section has visible question
   */
  setSectionHasVisibleQuestion(formSectionUniqueId: string) {
    let section = this.vote.sections.find((x) => x.uniqueId == formSectionUniqueId);
    if (section) {
      let sectionVisibleQuestions = this.vote.questionList.filter(
        (x) =>
          x.formSectionUniqueId == section?.uniqueId &&
          x.hasVisibleQuestionOrOption &&
          x.isActive &&
          !x.dontShow &&
          !x.endForm &&
          !x.parentUniqueId,
      );
      section.hasVisibleQuestion = sectionVisibleQuestions.length > 0;
    }
  }

  /**
   * در سوالات ماتریسی اگر ماتریس دو بعدی بود
   * سوال دوم با سوال اول باید تغییر وضعیت دهد
   */
  checkDouplicateQuestionInMatrix(question: QuestionModel): void {
    if (
      question.questionType === FormQuestionTypesEnum.Matrix_radio ||
      question.questionType === FormQuestionTypesEnum.Matrix_checkbox ||
      question.questionType === FormQuestionTypesEnum.Matrix_MultiShortText ||
      question.questionType === FormQuestionTypesEnum.Matrix_MultiNumeric
    ) {
      const parentQuestionIndex = this.vote.questionList.findIndex((x) => x.uniqueId === question.parentUniqueId);
      const questionIndex = this.vote.questionList.findIndex((x) => x.uniqueId === question.uniqueId);
      if (this.vote.questionList[parentQuestionIndex].matrixParts === 2) {
        this.vote.questionList[questionIndex + 1].dontShow = question.dontShow;
        this.vote.questionList[questionIndex + 1].endForm = question.endForm;
      }
    }
  }

  /**
   * بررسی پایان فرم
   * @param formQuestionUniqueId آیدی پرسش
   * @param result نتیجه
   * @param actionType نوع
   */
  async endFormTrigger(
    formQuestionUniqueId: string,
    result: boolean,
    actionType: ExpressionActionsEnum,
  ): Promise<void> {
    let findedQuestion = false;
    if (result === true) {
      if (this.vote.endFormStack.indexOf(formQuestionUniqueId) === -1) {
        this.vote.endFormStack.push(formQuestionUniqueId);
        // sort stack by question periority
        this.vote.endFormStack.sort((a, b) => {
          if (this.getQuestionNumberFromQuestionUniqueId(a) > this.getQuestionNumberFromQuestionUniqueId(b)) {
            return 1;
          }
          if (this.getQuestionNumberFromQuestionUniqueId(a) < this.getQuestionNumberFromQuestionUniqueId(b)) {
            return -1;
          } else {
            return 0;
          }
        });
      }

      for (const ql of this.vote.questionList) {
        if (findedQuestion === true) {
          ql.endForm = true;
          this.setSectionHasVisibleQuestion(ql.formSectionUniqueId);
        }
        if (ql.uniqueId === formQuestionUniqueId) {
          findedQuestion = true;
        }
      }
    } else {
      let lastEndQuestion: string = '';
      if (this.vote.endFormStack.length > 0) {
        lastEndQuestion = this.vote.endFormStack[0];
        if (lastEndQuestion === formQuestionUniqueId) {
          this.vote.endFormStack.splice(0, 1);
          lastEndQuestion = this.vote.endFormStack.length > 0 ? this.vote.endFormStack[0] : null;
        }
      }
      for (const ql of this.vote.questionList) {
        if (findedQuestion === true) {
          ql.endForm = false;
          this.setSectionHasVisibleQuestion(ql.formSectionUniqueId);
        }
        if (ql.uniqueId === formQuestionUniqueId) {
          findedQuestion = true;
        }
        if (ql.uniqueId === lastEndQuestion) {
          break;
        }
      }
    }
  }

  /*______________________________________________________________________________________________________________________*/
  /*--------------------------pagination----------------------------------*/
  public async nextSection(form: NgForm): Promise<void> {
    if (form.invalid && this.vote.isPreviewMode === false) {
      this.notify.warning(this.translateService.instant('CompleteFormInformationCorrectly'));
      form.control.markAllAsTouched();
      this.vote.showRequiredFormQuestionValidate = true;
      this.scrollToFirstInvalidControl();
      return;
    }
    this.vote.isLoadingNext = true;
    // console.time('NextPage');
    // AnimationPageChange.animationSlide(true);
    let idForRunFormula = this.vote.sections[this.vote.currentSectionPage].startFormQuestionUniqueId;
    if (this.vote.oneQuestionPerPage === true) {
      //console.log('next',this.vote.questionList[this.vote.pageOffset].title);
      idForRunFormula = this.vote.questionList[this.vote.pageOffset].uniqueId;
      await this.nextQuestion();
    } else {
      await this.getNextSection();
    }

    await this.runFormula(idForRunFormula);

    // اگر نمایش یک سوال در هر صفحه بود باید سوال بعدی بررسی شود
    // اگر سوالی که قرار است نمایش داده شود مخفی بود به سوال بعدی برود یا
    // اگر سوال بعدی فرزند ماتریس بود به سوال بعدی بروی
    if (
      this.vote.oneQuestionPerPage &&
      (!this.vote.questionList[this.vote.pageOffset].hasVisibleQuestionOrOption ||
        this.vote.questionList[this.vote.pageOffset].dontShow ||
        !this.vote.questionList[this.vote.pageOffset].isActive ||
        this.vote.questionList[this.vote.pageOffset].parentUniqueId)
    ) {
      await this.nextQuestion();
    }
    //console.timeEnd('NextPage');
    this.vote.isLoadingNext = false;
  }

  public async previousSection(form: NgForm): Promise<void> {
    //  console.time('PreviousPage');
    // AnimationPageChange.animationSlide(false);
    this.vote.isLoadingPrevious = true;
    let idForRunFormula = this.vote.sections[this.vote.currentSectionPage].startFormQuestionUniqueId;
    if (this.vote.oneQuestionPerPage === true) {
      await this.previousQuestion();
      idForRunFormula = this.vote.questionList[this.vote.pageOffset].uniqueId;
    } else {
      await this.getPreviousSection();
    }
    await this.runFormula(idForRunFormula);
    this.vote.showPreviousButton = CheckPagination.checkHasPreviousQuestion(this.vote);
    this.vote.showSubmitButton = !CheckPagination.checkHasNextQuestion(this.vote);
    // console.log(this.vote.questionList[this.vote.pageOffset].title);
    // console.timeEnd('PreviousPage');
    this.vote.isLoadingPrevious = false;
  }

  /**
   * دریافت پرسش ها هر بخش
   * @param sectionStep ایندکس بخش از صفر شروع میشود
   * @param isNext قرار است به صفحه بعدی برود یا قبلی
   */
  public async getSectionQuestions(sectionStep: number, isNext: boolean): Promise<void> {
    this.vote.pageQfrom = sectionStep;
    let section: SectionModel;
    // اگر هیچ بخش بندی وجود نداشت
    if (this.vote.sections.length === 0) {
      this.vote.pageSize = this.vote.questionList.length;
    } else if (sectionStep > this.vote.sections.length - 1) {
      this.vote.currentSectionPage = this.vote.sections.length - 1;
      return;
    } else if (sectionStep < 0) {
      this.vote.currentSectionPage = 0;
      return;
    } else {
      section = this.vote.sections[sectionStep];
      if (section.dontShow || !section.hasVisibleQuestion || section.isPopUp) {
        if (isNext) {
          this.vote.currentSectionPage++;
          await this.getSectionQuestions(this.vote.currentSectionPage, isNext);
        } else {
          this.vote.currentSectionPage--;
          await this.getSectionQuestions(this.vote.currentSectionPage, isNext);
        }
        return;
      }

      section = this.vote.sections[this.vote.currentSectionPage];
      let start = section.startFormQuestionUniqueId;
      let end = section.endFormQuestionUniqueId;
      let findedSection = false;
      this.vote.pageSize = 0;
      for (let i = 0; i < this.vote.questionList.length; i++) {
        if (this.vote.questionList[i].uniqueId === start) {
          if (
            this.vote.oneQuestionPerPage &&
            (!this.vote.questionList[i].isActive ||
              this.vote.questionList[i].dontShow ||
              !this.vote.questionList[i].hasVisibleQuestionOrOption ||
              this.vote.questionList[i].endForm)
          ) {
            start = this.vote.questionList[i + 1]?.uniqueId;
            continue;
          }
          findedSection = true;
          this.vote.pageQfrom = i;
          this.vote.pageOffset = i;
        }

        if (findedSection) {
          this.vote.pageSize++;
        }
        if (this.vote.questionList[i].uniqueId === end) {
          break;
        }
      }
    }
    await this.runFormula(this.vote.sections[this.vote.currentSectionPage].startFormQuestionUniqueId);
    window.scrollTo(0, 0);
  }

  /**
   * لود پرسش ها بخش بعدی
   */
  private async getNextSection(): Promise<void> {
    const currentSection: SectionModel = this.vote.sections[this.vote.currentSectionPage];
    await this.storeSection(currentSection, true);
    this.vote.showRequiredFormQuestionValidate = false;
    this.vote.lastPageSize.push(this.vote.pageSize);
    if (!currentSection.loopNumber) currentSection.loopNumber = 0;
    if (!this.vote.sections[this.vote.currentSectionPage].loopNumber) {
      this.vote.sections[this.vote.currentSectionPage].loopNumber = 0;
    }
    if (currentSection.hasLoop) {
      currentSection.loopNumber++;
      this.vote.sections[this.vote.currentSectionPage].loopNumber = currentSection.loopNumber;
    } else {
      this.vote.currentSectionPage++;
      if (this.vote.currentSectionPage < this.vote.sections.length) {
        await this.getSectionQuestions(this.vote.currentSectionPage, true);
      }
    }
    await this.loadQuestionsAnswersFromLocalStorage();
    window.scrollTo(0, 0);
  }

  /**
   * لود پرسش ها بخش قبلی
   */
  private async getPreviousSection(isPrev = false): Promise<void> {
    const currentSection: SectionModel = this.vote.sections[this.vote.currentSectionPage];
    await this.storeSection(currentSection);

    const lastPageSize = this.vote.lastPageSize.pop() ?? 0;
    if (!currentSection.loopNumber) currentSection.loopNumber = 0;
    if (!this.vote.sections[this.vote.currentSectionPage].loopNumber) {
      this.vote.sections[this.vote.currentSectionPage].loopNumber = 0;
    }

    if (currentSection.loopNumber === 0 && this.vote.currentSectionPage === 0) {
      return;
    }

    if (currentSection.loopNumber > 0) {
      if (isPrev === true) {
        this.vote.pageQfrom = this.vote.pageQfrom - lastPageSize;
      }
      currentSection.loopNumber--;
      this.vote.sections[this.vote.currentSectionPage].loopNumber = currentSection.loopNumber;
    } else {
      this.vote.currentSectionPage--;
      //  currentSection = this.vote.sections[this.vote.currentSectionPage];
      //  this.vote.pageQfrom = this.vote.pageQfrom - lastPageSize;
      await this.getSectionQuestions(this.vote.currentSectionPage, false);
    }
    await this.loadQuestionsAnswersFromLocalStorage(false);
    this.vote.pageSize = lastPageSize;
    window.scrollTo(0, 0);
  }

  /**
   * دریافت اولویت پرسش
   * @param uniqueId question uniqueId
   */
  private getQuestionNumberFromQuestionUniqueId(uniqueId: string | undefined): number {
    if (!uniqueId) {
      return 0;
    }
    const q = this.vote.questionList.find((x) => x.uniqueId === uniqueId);
    if (q) {
      return q.rowNumber ?? 0;
    } else {
      return 0;
    }
  }

  // ____________________________________________________________________________________

  /**
   * مشاهده سوال بعد در حالت نمایش تک صفحه ای
   * برای حالت هر سوال در یک صفحه
   */
  private async nextQuestion(): Promise<void> {
    this.vote.showRequiredFormQuestionValidate = false;
    const currentSection = this.vote.sections[this.vote.currentSectionPage];
    // اگر سوال آخر سکشن بود و سکشن تکرار داشت برو سکشن بعدی
    if (
      currentSection.hasLoop &&
      currentSection.endFormQuestionUniqueId === this.vote.questionList[this.vote.pageOffset].uniqueId
    ) {
      await this.getNextSection();
      this.vote.pageOffset = this.vote.questionList.findIndex(
        (x) => x.uniqueId === currentSection.startFormQuestionUniqueId,
      );
    } else if (currentSection.endFormQuestionUniqueId === this.vote.questionList[this.vote.pageOffset].uniqueId) {
      await this.storeSection(currentSection, true);
      this.vote.currentSectionPage++;
      let stepQ = 1;
      if (this.vote.sections[this.vote.currentSectionPage].isPopUp) {
        stepQ =
          this.vote.questionList.filter(
            (x) => x.formSectionUniqueId == this.vote.sections[this.vote.currentSectionPage].uniqueId,
          ).length + 1;
        this.vote.currentSectionPage++;
      }
      this.vote.pageOffset += stepQ;
      await this.loadQuestionsAnswersFromLocalStorage();
    } else {
      this.vote.pageOffset++;
    }
    let sectionOfQuestion = this.vote.sections.find(
      (x) => x.uniqueId == this.vote.questionList[this.vote.pageOffset].formSectionUniqueId,
    );

    if (
      (this.vote.oneQuestionPerPage &&
        (!this.vote.questionList[this.vote.pageOffset].hasVisibleQuestionOrOption ||
          this.vote.questionList[this.vote.pageOffset].dontShow ||
          !this.vote.questionList[this.vote.pageOffset].isActive ||
          this.vote.questionList[this.vote.pageOffset].parentUniqueId)) ||
      (sectionOfQuestion && sectionOfQuestion.dontShow)
    ) {
      await this.nextQuestion();
    }
  }
  /**
   *  نمایش سوال قبلی در حالت تک صفحه ای
   * برای حالت هر سوال در یک صفحه
   */
  private async previousQuestion(isPrev = false): Promise<void> {
    let currentSection = this.vote.sections[this.vote.currentSectionPage];
    if (currentSection.loopNumber == undefined || (this.vote.pageOffset <= 0 && currentSection.loopNumber === 0)) {
      return;
    }
    //  اگر سوال اول سکشن بود و تکرار داشت برو سوال آخر سکشن قبلی
    if (
      currentSection.loopNumber > 0 &&
      currentSection.startFormQuestionUniqueId === this.vote.questionList[this.vote.pageOffset].uniqueId
    ) {
      await this.getPreviousSection(false);
      this.vote.pageOffset = this.vote.questionList.findIndex(
        (x) => x.uniqueId === currentSection.endFormQuestionUniqueId,
      );
    } else if (
      currentSection.loopNumber === 0 &&
      currentSection.startFormQuestionUniqueId === this.vote.questionList[this.vote.pageOffset].uniqueId
    ) {
      await this.storeSection(currentSection);
      this.vote.currentSectionPage--;
      currentSection = this.vote.sections[this.vote.currentSectionPage];
      let stepQ = 1;
      if (currentSection.isPopUp) {
        stepQ = this.vote.questionList.filter((x) => x.formSectionUniqueId == currentSection.uniqueId).length + 1;
        this.vote.currentSectionPage--;
      }
      this.vote.pageOffset -= stepQ;
      await this.loadQuestionsAnswersFromLocalStorage(false);
    } else {
      this.vote.pageOffset--;
    }
    let sectionOfQuestion = this.vote.sections.find(
      (x) => x.uniqueId == this.vote.questionList[this.vote.pageOffset].formSectionUniqueId,
    );
    // اگر سوالی که قرار است نمایش داده شود مخفی بود به سوال بعدی برود یا
    // اگر سوال بعدی فرزند ماتریس بود به سوال بعدی بروی
    if (
      this.vote.questionList[this.vote.pageOffset].dontShow ||
      !this.vote.questionList[this.vote.pageOffset].hasVisibleQuestionOrOption ||
      !this.vote.questionList[this.vote.pageOffset].isActive ||
      this.vote.questionList[this.vote.pageOffset].parentUniqueId ||
      (sectionOfQuestion && (sectionOfQuestion.dontShow || !sectionOfQuestion.hasVisibleQuestion))
    ) {
      await this.previousQuestion();
    }
  }

  // ____________________________________________________________________________________

  public scrollToFirstInvalidControl(container?: Element | null): void {
    // window.scrollTo(0, 0);
    setTimeout(() => {
      const firstReqiredQuestion: HTMLElement | null = (container || this._document).querySelector(
        '.invalid-question:not(.type-' +
          FormQuestionTypesEnum.Matrix +
          '):not(.type-' +
          FormQuestionTypesEnum.Matrix_Dynamic +
          '):not(.type-' +
          FormQuestionTypesEnum.Group +
          ')' +
          ',.ng-invalid:not(form)',
      );
      //let top = 0;
      // console.log(firstReqiredQuestion);
      if (firstReqiredQuestion) {
        this.openParentMatrixBodyPanelByQuestionElement(firstReqiredQuestion);
        firstReqiredQuestion.scrollIntoView({ behavior: 'smooth' });
        //  top = this.getTopOffset(firstReqiredQuestion);
      }
      // window.scroll({
      //     top,
      //     left: 0,
      //     behavior: 'smooth'
      // });
    }, 200);
  }
  /**
   *  اگر پرسش در ماتریس بود و حالت موبایل بود باید پنل باز شود
   * @param el
   * @returns
   */
  openParentMatrixBodyPanelByQuestionElement(el: HTMLElement): void {
    if (el.tagName == 'MATRIX') {
      let b = el.querySelector('.matrix-panel-body:has(.is-invalid)');
      if (b) {
        b.classList.add('is-open');
      }
    } else {
      if (el.parentElement) {
        if (el.parentElement.classList.contains('matrix-panel-body')) {
          el.parentElement.classList.add('is-open');
        } else {
          this.openParentMatrixBodyPanelByQuestionElement(el.parentElement);
        }
      }
    }
  }
  // private getTopOffset(controlEl: HTMLElement): number {
  //     const labelOffset = 100;
  //     return controlEl.getBoundingClientRect().top + window.scrollY - labelOffset;
  // }

  /**
   * نمایش چه تعداد از سوالات به کاربر
   */
  public sliceFrom(): number {
    if (this.vote.oneQuestionPerPage) {
      return this.vote.pageOffset;
    } else {
      return this.vote.pageQfrom;
    }
  }

  /**
   * نمایش چه تعداد از سوالات به کاربر
   */
  public sliceTo(): number {
    if (this.vote.oneQuestionPerPage) {
      return this.vote.pageOffset + 1;
    } else {
      return this.vote.pageQfrom + this.vote.pageSize;
    }
  }

  /*--------------------------end pagination----------------------------------*/

  updateProgressBar(): void {
    if (this.themeService.theme.progressBar.hide) return;

    setTimeout(() => {
      let count = 0;
      let completed = 0;

      for (const section of this.vote.sections) {
        if (section.dontShow || !section.hasVisibleQuestion) continue;

        const questions = this.vote.questionList.filter((q) => q.formSectionUniqueId === section.uniqueId);

        for (const question of questions) {
          if (!this.shouldCountQuestion(question, questions)) continue;

          if (question.questionType === FormQuestionTypesEnum.RetailAudit) {
            for (const sku of question.selectedList ?? []) {
              count++;
              if (sku.formValid) completed++;
            }
            continue;
          }

          if (question.isActive && !question.dontShow && !question.endForm && question.hasVisibleQuestionOrOption) {
            switch (question.questionType) {
              case FormQuestionTypesEnum.HasPriority:
              case FormQuestionTypesEnum.FileUpload:
              case FormQuestionTypesEnum.VoiceRecord:
                count++;
                if (!question.invalid && question.answer?.length > 0) {
                  completed++;
                }
                break;
              case FormQuestionTypesEnum.Matrix:
              case FormQuestionTypesEnum.Matrix_Dynamic:
              case FormQuestionTypesEnum.Group:
              case FormQuestionTypesEnum.HtmlFrame:
              case FormQuestionTypesEnum.Chart:
              case FormQuestionTypesEnum.OpenPopUpSection:
                // ignored types
                break;
              default:
                count++;
                if (!question.invalid && !isNullOrEmpty(question.answer)) {
                  completed++;
                }
                break;
            }
          }
        }
      }

      this.vote.progressBarValue = count === 0 ? 0 : Math.round((completed * 100) / count);
    }, 100);
  }
  private shouldCountQuestion(question: QuestionModel, questions: QuestionModel[]): boolean {
    if (!question.parentUniqueId) return true;

    const parent = questions.find((q) => q.uniqueId === question.parentUniqueId);
    if (!parent) return false;

    const invalidParent =
      parent.dontShow ||
      parent.endForm ||
      !parent.isActive ||
      parent.questionType === FormQuestionTypesEnum.RetailAudit;

    return !invalidParent;
  }
  /**
   * ذخیره سکشن جاری در لوکال استوریج
   */
  async storeSection(section: SectionModel, isNextButton = false): Promise<void> {
    let pageIndex = await this.findPageIndex(section.uniqueId, section.loopNumber ?? 0);
    const page = new SectionSaveModel();
    if (pageIndex === -1) {
      page.formSectionUniqueId = section.uniqueId;
      page.loopNumber = section.loopNumber ?? 0;
      page.questionList = [];
      page.variables = this.getVariableAsDictionary();
      this.pages.push(page);
      pageIndex = this.pages.length - 1;
    } else {
      this.pages[pageIndex].variables = cloneDeep(this.getVariableAsDictionary());
    }
    const qIndexFrom = this.vote.questionList.findIndex((x) => x.uniqueId === section.startFormQuestionUniqueId);
    let qIndexTo = this.vote.questionList.findIndex((x) => x.uniqueId === section.endFormQuestionUniqueId);
    // اگر آخرین سوال سکشن فرزند داشت ، سوال آخر می شود آخرین سوال فرزند
    if (this.vote.questionList[qIndexTo] && this.vote.questionList[qIndexTo].questionChilds) {
      let childCount = this.vote.questionList[qIndexTo].questionChilds.length;
      // اگر پرسش گروهی بود ممکن است آخرین پرسش ماتریس باشد و آخرین پرسش می شود آخرین فرزند ماتریس در گروه
      if (
        this.vote.questionList[qIndexTo].questionChilds.length > 0 &&
        this.vote.questionList[qIndexTo].questionChilds[this.vote.questionList[qIndexTo].questionChilds.length - 1]
          .questionChilds
      ) {
        childCount +=
          this.vote.questionList[qIndexTo].questionChilds[this.vote.questionList[qIndexTo].questionChilds.length - 1]
            .questionChilds.length;
      }
      qIndexTo += childCount;
    }
    for (let i = qIndexFrom; i <= qIndexTo; i++) {
      const findedQuestion = this.pages[pageIndex].questionList.findIndex(
        (x) => x.uniqueId === this.vote.questionList[i].uniqueId,
      );
      if (findedQuestion > -1) {
        this.pages[pageIndex].questionList[findedQuestion] = cloneDeep(this.vote.questionList[i]);
      } else {
        this.pages[pageIndex].questionList.push(cloneDeep(this.vote.questionList[i]));
      }
    }
    this.pages[pageIndex].filledData = isNextButton;
  }

  /**
   *  پیدا کردن سکشنی که ذخیره شده است
   */
  async findPageIndex(formSectionUniqueId: string, loopNumber: number): Promise<number> {
    let page = -1;
    page = this.pages.findIndex((x) => x.formSectionUniqueId === formSectionUniqueId && x.loopNumber === loopNumber);
    return page;
  }

  /**
   * خالی کردن داده های سکشن
   */
  async resetQuestionsInSection(formSectionUniqueId: string): Promise<void> {
    let qList = this.vote.questionList.filter((x) => x.formSectionUniqueId == formSectionUniqueId);
    for (let q of qList) {
      if (q.questionType == FormQuestionTypesEnum.Group) {
        continue;
      }
      q.answerTitle = '';
      q.saveSuccess = undefined;
      if ([FormQuestionTypesEnum.FileUpload, FormQuestionTypesEnum.HasPriority].indexOf(q.questionType) > -1) {
        q.answer = [];
      } else {
        q.answer = '';
      }
      if (
        [
          FormQuestionTypesEnum.SkuCount_Dynamic,
          FormQuestionTypesEnum.HasPriority,
          // RetailAudit نباید خالی شود
          // FormQuestionTypesEnum.RetailAudit,
          FormQuestionTypesEnum.SkuCount,
        ].indexOf(q.questionType) > -1
      ) {
        q.selectedList = [];
      }
      q.descriptionAnswer = '';
      q.secondaryFieldValueFilter = '';
      if (q.questionOptions) {
        q.questionOptions.forEach((item) => {
          item.selected = false;
          item.disabled = false;
        });
      }

      if ([FormQuestionTypesEnum.PointQuestion].indexOf(q.questionType) > -1) {
        q.minimumAnswer = q.minimumAnswer ? +q.minimumAnswer : 0;
        q.maximumAnswer = q.maximumAnswer ? +q.maximumAnswer : 100;
        q.answer = q.answer ? +q.answer : q.minimumAnswer;
      }
      if (
        [FormQuestionTypesEnum.Point_NumericScale, FormQuestionTypesEnum.NPS].indexOf(q.questionType) > -1 &&
        q.settings?.noComment
      ) {
        q.settings.noComment = false;
      }
      // TODOTODOTODOTODO TODO
      for (let gVar of this.vote.gvarList) {
        if (gVar.formQuestionUniqueId === q.uniqueId) {
          await this.setGlobalVariableInInitialValues(gVar, true);
        }
      }
    }
    // TODO
    await this.setGlobalVariableInQuestionTitles();
  }

  /**
   * لود کردن پرسش های ذخیره شده در لوکال
   * هنگام رفتن به صفحه بعد یا قبل
   */
  async loadQuestionsAnswersFromLocalStorage(resetFormula = true): Promise<void> {
    const currentSection = this.vote.sections[this.vote.currentSectionPage];
    const pageIndex = await this.findPageIndex(currentSection?.uniqueId, currentSection?.loopNumber ?? 0);
    if (pageIndex === -1) {
      if (resetFormula) {
        await this.resetQuestionsInSection(currentSection?.uniqueId);
        await this.resetFormulaResultInCurrentSection(currentSection?.uniqueId);
      }
      return;
    }
    let finded = false;

    for (let i = 0; i < this.vote.questionList.length; i++) {
      if (this.vote.questionList[i].uniqueId === currentSection.startFormQuestionUniqueId) {
        finded = true;
      }
      if (finded) {
        const questionInLocal = this.pages[pageIndex].questionList.find(
          (x) => x.uniqueId === this.vote.questionList[i].uniqueId,
        );
        if (questionInLocal) {
          this.vote.questionList[i].answer = cloneDeep(questionInLocal.answer);
          this.vote.questionList[i].selectedList = cloneDeep(questionInLocal.selectedList);
          this.vote.questionList[i].selectedCount = cloneDeep(questionInLocal.selectedCount);

          //reset initial value
          if (isNullOrEmpty(this.vote.questionList[i].answer) == false && this.vote.questionList[i].hasInitialValue) {
            this.vote.questionList[i].hasInitialValue = false;
          }

          // set selected Options
          if (this.vote.questionList[i].questionOptions) {
            for (let opt of this.vote.questionList[i].questionOptions) {
              let answer: string[] = this.vote.questionList[i].answer?.toString()?.split(/،|,/) || [];
              opt.selected = answer.findIndex((x) => x == opt.uniqueId) > -1;
            }
          }
        } else {
          this.vote.questionList[i].answerTitle = '';
          if (
            [FormQuestionTypesEnum.FileUpload, FormQuestionTypesEnum.HasPriority].indexOf(
              this.vote.questionList[i].questionType,
            ) > -1
          ) {
            this.vote.questionList[i].answer = [];
          } else {
            this.vote.questionList[i].answer = '';
          }
          this.vote.questionList[i].descriptionAnswer = '';
          if (this.vote.questionList[i].questionOptions) {
            this.vote.questionList[i].questionOptions.forEach((item) => {
              item.selected = false;
            });
          }
        }
      }
      if (this.vote.questionList[i].uniqueId === currentSection.endFormQuestionUniqueId) {
        break;
      }
    }
    if (resetFormula) await this.resetFormulaResultInCurrentSection(currentSection?.uniqueId);
  }

  /**
   * وقتی که سوالات از لوکال استوریج بر روی فرم پر می شوند
   * لازم است فرمول های روی آن ها مجددا اعمال شود
   * به هین دلیل باید فرمول ها را به حالت اولیه تغییر داد
   */
  async resetFormulaResultInCurrentSection(formSectionUniqueId: string): Promise<void> {
    const questionsInCurrentSection: string[] = this.vote.questionList
      .filter((x) => x.formSectionUniqueId == formSectionUniqueId)
      .map((m) => m.uniqueId);
    for (const item of this.vote.formulaList) {
      if (questionsInCurrentSection.indexOf(item.formQuestionUniqueId ?? '') > -1) {
        item.result = undefined;
        item.expressionReplacedText = undefined;
        item.resultUpdated = undefined;
      }
    }
    for (const item of this.vote.gvarList) {
      if (questionsInCurrentSection.indexOf(item.formQuestionUniqueId) > -1) {
        item.result = undefined;
        item.resultUpdated = undefined;
      }
    }
  }

  getVariableAsDictionary(): { [key: string]: string } {
    const variabels: { [key: string]: string } = {};
    for (const item of this.vote.gvarList) {
      variabels[item.title] = item.result;
    }
    return variabels;
  }

  triggerUpdateQuestionFormula(question: QuestionModel) {
    app.event.trigger(EventEnum.TriggerUpdateFormula + question.uniqueId, true);
    // console.info('trigger', EventEnum.TriggerUpdateFormula + question.uniqueId, true);
    if (question.parentUniqueId) {
      let parentIndex = this.vote.questionList.findIndex((x) => x.uniqueId === question.parentUniqueId);
      if (parentIndex > -1) {
        app.event.trigger(EventEnum.TriggerUpdateFormula + this.vote.questionList[parentIndex].uniqueId, true);
        // console.info('trigger', EventEnum.TriggerUpdateFormula + this.vote.questionList[parentIndex].uniqueId, true);
      }
    }
  }

  /**
   * دریافت نتیجه تائید/رد/رد و خاتمه پرسشنامه
   * در هنگام ذخیره نهایی پرسشنامه
   */
  getConfirmOrRejectExpressionAction(): ExpressionActionsEnum | undefined {
    const formulaValidList = this.vote.formulaList.filter(
      (x) => x.actionType === ExpressionActionsEnum.SetValid && x.result === true,
    );
    const formulaInValidList = this.vote.formulaList.filter(
      (x) => x.actionType === ExpressionActionsEnum.SetInvalid && x.result === true,
    );
    if (formulaInValidList.length > 0) {
      return ExpressionActionsEnum.SetInvalid;
    } else if (formulaValidList.length > 0) {
      return ExpressionActionsEnum.SetValid;
    } else {
      return undefined;
    }
  }
}
