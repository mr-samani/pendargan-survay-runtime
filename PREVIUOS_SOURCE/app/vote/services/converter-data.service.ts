import { Injectable } from '@angular/core';
import { HasDescriptionTypeEnum } from '@core/models/enums';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { CreateVoterWithDetailsDto } from '@core/models/backend-dto/CreateVoterWithDetailsDto';
import { QuestionModel } from '@core/models/QuestionModel';
import { VoteSharedService } from './vote-service';
import { LogicService } from './logic.service';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { cloneDeep } from 'lodash-es';
import { FileModel, UploadStatusEnum } from '../elements/file-upload/file.model';
import { FileStateEnum } from '../elements/file-upload-pwa/file-upload-pwa.model';
import { AppConsts } from '@core/app-consts';
import { isImage, isVideo } from '@core/helper/file.helper';
import { SelectedSkuIteModel } from '@core/models/SelectedSkuIteModel';
import { AddOrUpdateQuestionAnswerDetailsInputDto } from '@core/models/backend-dto/AddOrUpdateQuestionAnswerDetailsInputDto';
import { DataService } from '@core/services/data-service.service';
import { Observable, Subject, catchError, debounce, finalize, from, map, mergeMap, of, switchMap, timer } from 'rxjs';
import { PollRoute } from '../helpers/poll-route';
import { RepeatedFormSectionDto } from '@core/models/backend-dto/RepeatedFormSectionDto';
import { CreateVoterAnswerDetailDto } from '@core/models/backend-dto/CreateVoterAnswerDetailDto';
import { VoterAnswerDetailListAndSectionIdDto } from '@core/models/backend-dto/VoterAnswerDetailListAndSectionIdDto';
import { GetTempVoterForLoadDto } from '@core/models/backend-dto/GetTempVoterForLoadDto';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';
import { GetFormQuestionAnswerDto } from '@core/models/backend-dto/voter-details/GetFormQuestionAnswerDto';
import { FormSectionLoopQuestionAnswerDto } from '@core/models/backend-dto/voter-details/FormSectionLoopQuestionAnswerDto';
@Injectable()
export class ConverterDataService {
  /**
   *  ذخیره خودکار پاسخ های یک پرسش
   */
  autoSaveQuestionAnswer$ = new Subject<QuestionModel>();
  lastSaveQuestionId = '';
  constructor(
    private vote: VoteSharedService,
    private dataService: DataService,
  ) {
    this.autoSaveQuestionAnswer$
      .pipe(
        debounce((change) => (change.uniqueId !== this.lastSaveQuestionId ? of(0) : timer(500))),
        // distinctUntilChanged((p, c) => p.uniqueId != c.uniqueId || p.answer != c.answer),
        // distinctUntilChanged((p, c) => p.uniqueId === c.uniqueId && p.answer === c.answer),
        mergeMap((change) => {
          this.lastSaveQuestionId = change.uniqueId;
          return this.autoSaveQuestionAnswer(change);
        }),
      )
      .subscribe();
  }

  /**
   * تبدیل پاسخ ها به فرمت بک اند
   * @param isTemporarySave آیا ذخیره موقت است؟
   * @param isPartial ذخیره تکه ای- برای پرسش پرداخت باید اطلاعات فرم قبل از رفتن به صفحه پرداخت ذخیره شود
   * @returns CreateVoterWithDetailsDto
   */
  async getDataForSave(
    logicService: LogicService,
    isTemporarySave: boolean,
    isPartial = false,
    partialRegisterFormQuestionUniqueId: string,
    tenantPaymentGatewayId: string,
  ): Promise<CreateVoterWithDetailsDto> {
    const confirmOrRejectExpressionAction = logicService.getConfirmOrRejectExpressionAction();
    await this.changeRetailAuditToSectionLoop(logicService, isTemporarySave);
    const pollRoute = await PollRoute.get(this.vote.formGuid);
    const postData: CreateVoterWithDetailsDto = {
      guid: this.vote.formGuid,
      voterDetail: {
        elapsedTime: this.vote.timerCounter,
        guid: this.vote.formGuid,
        latitude: this.vote.userPosition && this.vote.userPosition.lat ? this.vote.userPosition.lat : undefined,
        longitude: this.vote.userPosition && this.vote.userPosition.lng ? this.vote.userPosition.lng : undefined,
        gpsAccuracy:
          this.vote.userPosition && this.vote.userPosition.accuracyMeters
            ? this.vote.userPosition.accuracyMeters
            : undefined,
        regionUniqueId: this.vote.lastRegionChildId ? this.vote.lastRegionChildId : '',
        expressionActions: confirmOrRejectExpressionAction,
        completionPercentage: this.vote.progressBarValue,
        pollRoute: pollRoute,
        voiceRecordFileIdUnique: [],
      },
      formSections: [],
      allocationType: this.vote.allocationType,
      variablesLastValue: {},
      temporarySave: isTemporarySave,
      acceptPreviousData: this.vote.acceptPreviousData,
      partialRegisterForPayment: undefined,
    };
    if (isPartial) {
      postData.partialRegisterForPayment = {
        partialRegisterFormQuestionUniqueId: partialRegisterFormQuestionUniqueId,
        tenantPaymentGatewayId: tenantPaymentGatewayId,
      };
    }
    for (const section of this.vote.sections) {
      if (!section.dontShow) {
        const repeatedSection: RepeatedFormSectionDto[] = [];
        const repeatedPage = logicService.pages.filter(
          (x) => x.formSectionUniqueId === section.uniqueId && x.filledData === true,
        );
        for (const pageSection of repeatedPage) {
          let voterDetail: CreateVoterAnswerDetailDto[] = [];
          // tslint:disable-next-line: prefer-for-of
          for (let qi = 0; qi < pageSection.questionList.length; qi++) {
            voterDetail = [
              ...voterDetail,
              ...(await this.getAnswerOfQuestion(pageSection.questionList[qi], pageSection.dynamicDataRecordId)),
            ];
          }
          if (voterDetail.length > 0) {
            repeatedSection.push({
              voterAnswerDetails: voterDetail,
              variablesRepeatedSectionValue: pageSection.variables,
            });
          }
        }

        /// _________________________
        if (repeatedSection.length > 0) {
          if (!postData.formSections) postData.formSections = [];
          postData.formSections.push({
            repeatSections: repeatedSection,
          });
        }
      }
    }

    postData.variablesLastValue = this.getVariableLastValues(postData.formSections);
    return postData;
  }

  async getAnswerOfQuestion(
    question: QuestionModel,
    dynamicDataRecordId?: number | string,
  ): Promise<CreateVoterAnswerDetailDto[]> {
    if (question.dontShow || question.endForm || !question.isActive || !question.hasVisibleQuestionOrOption) {
      if (question.questionType != FormQuestionTypesEnum.Group) return [];
    }
    let answer = new CreateVoterAnswerDetailDto();
    let voterDetail: CreateVoterAnswerDetailDto[] = [];
    switch (question.questionType) {
      case FormQuestionTypesEnum.UniqueSelect:
      case FormQuestionTypesEnum.Dropdown:
      case FormQuestionTypesEnum.MultiSelect:
      case FormQuestionTypesEnum.Matrix_checkbox:
      case FormQuestionTypesEnum.Matrix_radio:
      case FormQuestionTypesEnum.Matrix_MultiShortText:
      case FormQuestionTypesEnum.Matrix_MultiNumeric:
      case FormQuestionTypesEnum.Emoji:
      case FormQuestionTypesEnum.UniqueSelectWithImageOptions:
      case FormQuestionTypesEnum.MultiSelectWithImageOptions:
        for (let a = 0; a < question.questionOptions.length; a++) {
          if (question.questionOptions[a].selected && question.questionOptions[a].dontShow !== true) {
            answer = {
              questionOptionUniqueId: question.questionOptions[a].uniqueId,
              formQuestionUniqueId: question.uniqueId,
              answerTitle: question.questionOptions[a].title,
              answerDescription: this.getQuestionOtherDescription(question, question.questionOptions[a].uniqueId),
              dynamicDataRecordId,
              files: [],
              orderAnswer: undefined,
              validationGuid: '',
              formQuestionInitialValue: question.evaluateInitialValue,
            };
            voterDetail.push(answer);
          }
        }
        break;
      case FormQuestionTypesEnum.HasPriority:
        if (!question.answer) {
          question.answer = '';
        }
        let ans: string[] = [];
        if (typeof question.answer == 'string') {
          ans = question.answer.split(/،|,/).filter((x2: string) => !isNullOrEmpty(x2));
        }
        for (let i = 0; i < ans.length; i++) {
          let opt = question.questionOptions.find((x) => x.uniqueId == ans[i]);
          if (opt) {
            answer = {
              questionOptionUniqueId: opt.uniqueId,
              formQuestionUniqueId: question.uniqueId,
              answerTitle: opt.title,
              answerDescription: this.getQuestionOtherDescription(question, opt.uniqueId),
              orderAnswer: i + 1,
              dynamicDataRecordId,
              files: [],
              validationGuid: '',
              formQuestionInitialValue: question.evaluateInitialValue,
            };
            voterDetail.push(answer);
          }
        }
        break;
      case FormQuestionTypesEnum.SkuCount:
        if (question.selectedList) {
          for (const sku of question.selectedList) {
            answer = {
              questionOptionUniqueId: sku.questionOptionUniqueId ?? '',
              formQuestionUniqueId: question.uniqueId,
              answerTitle: sku.answerTitle ?? '',
              answerDescription: sku.total?.toString() ?? '',
              dynamicDataRecordId,
              files: [],
              orderAnswer: undefined,
              validationGuid: '',
              formQuestionInitialValue: question.evaluateInitialValue,
            };
            voterDetail.push(answer);
          }
        }
        break;
      case FormQuestionTypesEnum.SkuCount_Dynamic:
        if (question.selectedList) {
          for (const sku of question.selectedList) {
            answer = {
              dynamicDataRecordId: sku.identificationCode,
              questionOptionUniqueId: '',
              formQuestionUniqueId: question.uniqueId,
              answerTitle: sku.answerTitle ?? '',
              answerDescription: sku.total?.toString() ?? '',
              files: [],
              orderAnswer: undefined,
              validationGuid: '',
              formQuestionInitialValue: question.evaluateInitialValue,
            };
            voterDetail.push(answer);
          }
        }
        break;
      case FormQuestionTypesEnum.RetailAudit:
        // پرسش های ریتیل باید به حلقه تبدیل شوند در changeRetailAuditToSectionLoop هندل شده است
        break;
      case FormQuestionTypesEnum.PointQuestion:
      case FormQuestionTypesEnum.Rating:
      case FormQuestionTypesEnum.Numeric:
      case FormQuestionTypesEnum.Date:
      case FormQuestionTypesEnum.Time:
      case FormQuestionTypesEnum.Email:
      case FormQuestionTypesEnum.Mobile:
      case FormQuestionTypesEnum.NationalCode:
      case FormQuestionTypesEnum.Phone:
      case FormQuestionTypesEnum.ShortText:
      case FormQuestionTypesEnum.LongText:
      case FormQuestionTypesEnum.Location:
      case FormQuestionTypesEnum.PostalCode:
      case FormQuestionTypesEnum.CustomMaskShortText:
        answer = {
          questionOptionUniqueId: '',
          formQuestionUniqueId: question.uniqueId,
          answerTitle: '',
          answerDescription: question.answer,
          dynamicDataRecordId,
          validationGuid: question.hasVerification ? question.validationGuid : '',
          files: [],
          orderAnswer: undefined,
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        voterDetail.push(answer);
        break;
      case FormQuestionTypesEnum.Point_NumericScale:
      case FormQuestionTypesEnum.NPS:
        answer = {
          questionOptionUniqueId: '',
          formQuestionUniqueId: question.uniqueId,
          answerTitle:
            question.settings && question.settings.showNoCommentOption && question.settings.noComment
              ? question.settings.noCommentOptionText
                ? question.settings.noCommentOptionText
                : 'NoComment'
              : '',
          answerDescription: question.answer,
          dynamicDataRecordId,
          files: [],
          orderAnswer: undefined,
          validationGuid: '',
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        voterDetail.push(answer);
        break;
      case FormQuestionTypesEnum.DynamicAnswer:
        answer = {
          questionOptionUniqueId: '',
          dynamicDataRecordId: question.answer ? question.answer.identificationCode : '',
          formQuestionUniqueId: question.uniqueId,
          answerTitle: question.answer ? question.answer.answerTitle : '',
          answerDescription: '',
          files: [],
          orderAnswer: undefined,
          validationGuid: '',
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        voterDetail.push(answer);
        break;
      case FormQuestionTypesEnum.VoiceRecord:
      case FormQuestionTypesEnum.FileUpload:
        answer = {
          questionOptionUniqueId: '',
          formQuestionUniqueId: question.uniqueId,
          answerTitle: '',
          answerDescription: '',
          files: [],
          dynamicDataRecordId,
          orderAnswer: undefined,
          validationGuid: '',
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        if (question.answer) {
          for (let f = 0; f < question.answer.length; f++) {
            answer.files?.push({
              fileId: question.answer[f].fileId,
              fileUniqueId: question.answer[f].fileUniqueId,
              order: f,
            });
          }
        }
        voterDetail.push(answer);
        break;
      case FormQuestionTypesEnum.Captcha:
        answer = {
          questionOptionUniqueId: '',
          formQuestionUniqueId: question.uniqueId,
          answerTitle: '',
          answerDescription: question.validationKey ?? '',
          dynamicDataRecordId,
          validationGuid: question.answer,
          files: [],
          orderAnswer: undefined,
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        voterDetail.push(answer);
        break;
      case FormQuestionTypesEnum.Payment:
        answer = {
          questionOptionUniqueId: '',
          formQuestionUniqueId: question.uniqueId,
          answerTitle: question.settings?.amount + '',
          answerDescription: question.validationKey ?? '',
          dynamicDataRecordId,
          validationGuid: question.answer,
          files: [],
          orderAnswer: undefined,
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        voterDetail.push(answer);
        break;
      case FormQuestionTypesEnum.Group:
        answer = {
          questionOptionUniqueId: '',
          dynamicDataRecordId: undefined,
          formQuestionUniqueId: question.uniqueId,
          answerTitle: '',
          answerDescription: question.answer,
          orderAnswer: 0,
          files: [],
          validationGuid: '',
          formQuestionInitialValue: question.evaluateInitialValue,
        };
        voterDetail.push(answer);
        break;
    }
    return voterDetail;
  }

  /**
   * بررسی اینکه گزینه ی انتخابی سایر داشته است
   */
  getQuestionOtherDescription(question: QuestionModel, optionUniqueId: string): string {
    if (!question.hasDescription) return '';
    let opt = question.questionOptions.find((x) => x.uniqueId == optionUniqueId);
    if (question.questionType === FormQuestionTypesEnum.MultiSelect && opt) {
      if (opt.selected) {
        return opt.answerDescription ?? '';
      }
    }
    if (question.descriptionType == HasDescriptionTypeEnum.AllOptions) return question.descriptionAnswer ?? '';
    if (question.descriptionType == HasDescriptionTypeEnum.SelectedOption && opt && opt.hasDescriptiveAnswer)
      return question.descriptionAnswer ?? '';

    if (
      question.descriptionType == HasDescriptionTypeEnum.LastOption &&
      optionUniqueId == question.questionOptions[question.questionOptions.length - 1]?.uniqueId
    ) {
      return question.descriptionAnswer ?? '';
    }
    return '';
  }

  isChangedInitialValue(question: QuestionModel): boolean {
    if (!question.evaluateInitialValue) return false;
    return question.answer != question.evaluateInitialValue;
  }

  getVariableLastValues(formSections?: VoterAnswerDetailListAndSectionIdDto[]): {
    [key: string]: string;
  } {
    if (!formSections) {
      return {};
    }
    let result: { [key: string]: string } = {};
    for (let s of formSections) {
      for (let l of s.repeatSections ?? []) {
        result = { ...result, ...l.variablesRepeatedSectionValue };
      }
    }
    return result;
  }

  /**
   * هر گزینه از پرسش retail audit باید به عنوان یک حلقه به بک اند ارسال شود
   */
  async changeRetailAuditToSectionLoop(logicService: LogicService, isTemporarySave: boolean): Promise<void> {
    let retailPage = logicService.pages.findIndex(
      (p) => p.questionList.findIndex((q) => q.questionType == FormQuestionTypesEnum.RetailAudit) > -1,
    );
    if (retailPage == -1) {
      return;
    }
    const indexOfRetailQuestion = logicService.pages[retailPage].questionList.findIndex(
      (x) => x.questionType == FormQuestionTypesEnum.RetailAudit,
    );
    let retailSection = logicService.pages[retailPage].questionList[indexOfRetailQuestion];
    let loopNumber = 1;
    // delete parent question of retail audit
    logicService.pages[retailPage].questionList = [];
    logicService.pages[retailPage].formSectionUniqueId = retailSection.formSectionUniqueId;
    for (let item of retailSection.selectedList) {
      // ذخیره فرم  => فقط فرم های تکمیل شده
      if (isTemporarySave == false && item.formValid != true) {
        continue;
      }
      // ذخیره موقت => فرم های ناقص هم ذخیره شوند
      else if (isTemporarySave == true && item.formValid == undefined) {
        continue;
      }
      // add sku row as dynamic answer
      let fakeQuestionDynamicAnswer = new QuestionModel();
      fakeQuestionDynamicAnswer.uniqueId = retailSection.uniqueId;
      // نوع پرسش باید حتما DynamicAnswer باشد یک فرم نمیتواند چندین پرسش ریتیل داشته باشد
      fakeQuestionDynamicAnswer.questionType = FormQuestionTypesEnum.DynamicAnswer;
      fakeQuestionDynamicAnswer.dontShow = false;
      fakeQuestionDynamicAnswer.endForm = false;
      fakeQuestionDynamicAnswer.isActive = true;
      fakeQuestionDynamicAnswer.hasVisibleQuestionOrOption = true;
      fakeQuestionDynamicAnswer.answer = {
        identificationCode: item.identificationCode,
        answerTitle: item.answerTitle,
      };
      let children: QuestionModel[] = [];
      if (item.questionChilds) {
        item.questionChilds.unshift(fakeQuestionDynamicAnswer);
        for (let child of item.questionChilds) {
          if (
            [FormQuestionTypesEnum.Matrix, FormQuestionTypesEnum.Matrix_Dynamic, FormQuestionTypesEnum.Group].indexOf(
              child.questionType,
            ) > -1
          ) {
            children = [...children, ...child.questionChilds];
          } else {
            children.push(child);
          }
        }
      }
      const data = {
        loopNumber: loopNumber,
        questionList: children,
        formSectionUniqueId: retailSection.formSectionUniqueId,
        variables: item.retaliVariables ?? {},
        filledData: true,
        dynamicDataRecordId: item.identificationCode,
      };
      let findPageForEdt = await logicService.pages.findIndex(
        (x) =>
          x.dynamicDataRecordId == item.identificationCode &&
          x.formSectionUniqueId == retailSection.formSectionUniqueId &&
          x.loopNumber == loopNumber,
      );
      if (findPageForEdt > -1) {
        logicService.pages[findPageForEdt] = data;
      } else {
        logicService.pages.splice(retailPage + loopNumber, 0, data);
      }
      loopNumber++;
    }
  }

  /*-----------------------------------------------------------------------------------------------------------*/
  /*-----------------------------------------------------------------------------------------------------------*/
  /*-----------------------------------------------------------------------------------------------------------*/

  loadSavedData(
    logicService: LogicService,
    voter: GetVoterFullDetail,
    tempVoter?: GetTempVoterForLoadDto,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.vote.timerCounter = tempVoter && tempVoter.elapsedTime ? tempVoter.elapsedTime : 0;
        logicService.pages = [];
        if (!voter.formSections) {
          reject();
          return;
        }
        for (let tempSection of voter.formSections) {
          for (let tempLoop of tempSection.sectionLoopQuestionAnswerDetail) {
            let isRetailPage =
              tempLoop.sectionQuestionAnswerDetail.findIndex(
                (x) => x.questionType == FormQuestionTypesEnum.RetailAudit,
              ) > -1;
            let section = this.vote.sections.find((x) => x.uniqueId == tempSection.formSectionUniqueId);
            let qList: QuestionModel[] = this.setAnswerInQuestions(
              tempLoop.sectionQuestionAnswerDetail,
              tempSection.sectionLoopQuestionAnswerDetail,
            );
            logicService.pages.push({
              loopNumber: tempLoop.loopNumber - 1,
              questionList: cloneDeep(qList),
              formSectionUniqueId: tempSection.formSectionUniqueId,
              filledData: section && section.isPopUp ? true : false,
              variables: {},
            });
            if (isRetailPage) {
              break;
            }
          }
        }
        // console.log('pages', this.logicService.pages);
        resolve();
      } catch (error) {
        reject();
      }
    }); //<-- promise
  }

  setAnswerInQuestions(
    tempLoop: GetFormQuestionAnswerDto[],
    repeatedSections: FormSectionLoopQuestionAnswerDto[],
  ): QuestionModel[] {
    let qList: QuestionModel[] = [];
    for (let tempQ of tempLoop) {
      let findedQ = this.vote.questionList.find((x) => x.uniqueId === tempQ.uniqueId);
      if (findedQ) {
        findedQ.temporaryAnswerApplied = tempQ.voterAnswerDetailDto && tempQ.voterAnswerDetailDto.length > 0;
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
            let answer = [];
            for (let ans of tempQ.voterAnswerDetailDto) {
              for (let opt of findedQ.questionOptions) {
                opt.selected = false;
                opt.answerDescription = '';
                if (opt.uniqueId == ans.questionOptionUniqueId) {
                  opt.selected = true;
                  opt.orderAnswer = ans.orderAnswer;
                  opt.answerDescription = ans.answerDescription;
                  answer.push(opt.uniqueId);
                }
              }
            }
            findedQ.answer = answer.join(',');
            break;
          case FormQuestionTypesEnum.ShortText:
          case FormQuestionTypesEnum.LongText:
          case FormQuestionTypesEnum.Date:
          case FormQuestionTypesEnum.Time:
          case FormQuestionTypesEnum.Email:
          case FormQuestionTypesEnum.Mobile:
          case FormQuestionTypesEnum.NationalCode:
          case FormQuestionTypesEnum.Phone:
          case FormQuestionTypesEnum.Numeric:
          case FormQuestionTypesEnum.PointQuestion:
          case FormQuestionTypesEnum.Rating:
          case FormQuestionTypesEnum.NPS:
          case FormQuestionTypesEnum.Point_NumericScale:
          case FormQuestionTypesEnum.Location:
          case FormQuestionTypesEnum.PostalCode:
          case FormQuestionTypesEnum.CustomMaskShortText:
            if (tempQ.voterAnswerDetailDto && tempQ.voterAnswerDetailDto.length > 0) {
              findedQ.answer = tempQ.voterAnswerDetailDto[0].answerDescription;
              if (isNullOrEmpty(findedQ.answer) == false && findedQ.hasInitialValue && findedQ.isEditableInitialValue) {
                findedQ.hasInitialValue = false;
              }
            }
            break;
          case FormQuestionTypesEnum.FileUpload:
            if (tempQ.voterAnswerDetailDto && tempQ.voterAnswerDetailDto.length > 0) {
              let files = tempQ.voterAnswerDetailDto[0].files ?? [];
              findedQ.answer = [];
              for (let f of files) {
                if (f.file) {
                  findedQ.answer.push({
                    status: UploadStatusEnum.Success,
                    name: f.file.fileName,
                    size: f.file.size,
                    humanSize: f.file.size + '',
                    data: AppConsts.fileServerUrl + '/' + f.file.uniqueId,
                    ext: f.file.extension,
                    fileType: f.file.contentType,
                    isImage: isImage(f.file.extension),
                    isVideo: isVideo(f.file.extension),
                    addressUrl: AppConsts.fileServerUrl + '/' + f.file.uniqueId,
                    progress: 100,
                    fileState: FileStateEnum.UploadFailed,
                    fileId: f.file.id,
                    fileUniqueId: f.file.uniqueId,
                  } as FileModel);
                }
              }
            }
            break;
          case FormQuestionTypesEnum.DynamicAnswer:
            if (tempQ.voterAnswerDetailDto && tempQ.voterAnswerDetailDto.length > 0) {
              findedQ.answer = {
                identificationCode: tempQ.voterAnswerDetailDto[0].dynamicDataRecordId,
                id: tempQ.voterAnswerDetailDto[0].dynamicDataRecordId,
                answerTitle: tempQ.voterAnswerDetailDto[0].answerTitle,
                jsonValuesDictionary: tempQ.voterAnswerDetailDto[0].jsonValuesDictionary,
              };
            }
            break;
          case FormQuestionTypesEnum.SkuCount:
          case FormQuestionTypesEnum.SkuCount_Dynamic:
            let selectedItemList: SelectedSkuIteModel[] = [];
            for (let ans of tempQ.voterAnswerDetailDto) {
              selectedItemList.push({
                identificationCode: ans.dynamicDataRecordId ?? 0,
                questionOptionUniqueId: ans.questionOptionUniqueId,
                answerTitle: ans.answerTitle,
                quantity: 1,
                total: +(ans.answerDescription ?? 0),
                history: [],
                ordering: 0,
                dynamicDataUniqueId: findedQ.dynamicDataUniqueId!,
                answerTitleLower: ans.answerTitle?.toLowerCase(),
                answerTitleLowerNoSpace: ans.answerTitle?.toLowerCase()?.replace(/ /g, ''),
                jsonValuesDictionary: {},
                formValid: undefined,
                retaliVariables: {},
                questionChilds: [],
              });
            }
            findedQ.answer = selectedItemList;
            break;
          /**
           * برای پرسش های retailaudit:
           * گزینه های انتخاب شده به عنوان یک حلقه ثبت شده اند
           **/
          case FormQuestionTypesEnum.RetailAudit:
            if (repeatedSections.length > 0) {
              let retailItemList: SelectedSkuIteModel[] = [];
              for (let tttt of repeatedSections) {
                let sku = tttt.sectionQuestionAnswerDetail.find(
                  (x) => x.questionType == FormQuestionTypesEnum.RetailAudit,
                );
                if (sku) {
                  let s = sku.voterAnswerDetailDto[0];
                  if (!s) {
                    continue;
                  }
                  let otherQuestions = tttt.sectionQuestionAnswerDetail.filter(
                    (x) => x.questionType != FormQuestionTypesEnum.RetailAudit,
                  );
                  let childs = this.setAnswerInQuestions(otherQuestions, []);

                  for (let c of childs) {
                    if (
                      [
                        FormQuestionTypesEnum.Matrix,
                        FormQuestionTypesEnum.Matrix_Dynamic,
                        FormQuestionTypesEnum.Group,
                      ].indexOf(c.questionType) > -1
                    ) {
                      c.questionChilds = cloneDeep(childs.filter((x) => x.parentUniqueId == c.uniqueId));
                    }
                  }
                  retailItemList.push({
                    identificationCode: s.dynamicDataRecordId ?? 0,
                    ordering: 0,
                    answerTitle: s.answerTitle,
                    dynamicDataUniqueId: findedQ.dynamicDataUniqueId!,
                    quantity: 0,
                    total: 0,
                    history: [],
                    questionChilds: cloneDeep(childs),
                    formValid: this.checkAllChildrenIsValid(childs),
                    jsonValuesDictionary: s.jsonValuesDictionary,
                    answerTitleLower: s.answerTitle?.toLowerCase(),
                    answerTitleLowerNoSpace: s.answerTitle?.toLowerCase()?.replace(/ /g, ''),
                    retaliVariables: {},
                  });
                }
              }
              findedQ.answer = retailItemList;
              findedQ.selectedList = retailItemList;
              // console.log('sku-answer', findedQ.answer);
            }
            break;
          case FormQuestionTypesEnum.Captcha:
            if (tempQ.voterAnswerDetailDto && tempQ.voterAnswerDetailDto.length > 0) {
              findedQ.validationKey = tempQ.voterAnswerDetailDto[0].answerDescription;
              findedQ.answer = tempQ.voterAnswerDetailDto[0].validationGuid;
            }
            break;
          case FormQuestionTypesEnum.Payment:
            if (tempQ.voterAnswerDetailDto && tempQ.voterAnswerDetailDto.length > 0) {
              findedQ.validationKey = tempQ.voterAnswerDetailDto[0].answerDescription;
              findedQ.answer = tempQ.voterAnswerDetailDto[0].validationGuid;
            }
            break;
        }
        if ((findedQ.hasDescription || tempQ.hasDescription) && tempQ.voterAnswerDetailDto) {
          findedQ.descriptionAnswer = tempQ.voterAnswerDetailDto.find((x) => x.answerDescription)?.answerDescription;
        }
        qList.push(cloneDeep(findedQ));
      }
    }
    return qList;
  }

  private checkAllChildrenIsValid(childs: QuestionModel[]) {
    return (
      childs.filter((x) => isNullOrEmpty(x.answer) && x.isRequired && !x.endForm && !x.dontShow && x.isActive).length ==
      0
    );
  }

  /*--------------------------------------------------------------------------------------------------------------------*/
  /**
   * ذخیره خودکار پاسخ های یک پرسش
   * @param question A question to be saved
   * @returns
   */
  private autoSaveQuestionAnswer(question: QuestionModel): Observable<any> {
    question.loading = true;
    return from(this.getAnswerOfQuestion(question, undefined)).pipe(
      switchMap((voterAnswerDetails) => {
        const input = new AddOrUpdateQuestionAnswerDetailsInputDto();
        input.voterAnswerDetails = voterAnswerDetails;

        if (input.voterAnswerDetails.length === 0) {
          question.loading = false;
          return of(false);
        }

        input.formQuestionUniqueId = question.uniqueId;
        input.guid = this.vote.formGuid;
        input.loopIndexNumber = (this.vote.sections[this.vote.currentSectionPage]?.loopNumber ?? 0) + 1;
        input.questionVariablesValue = this.getQuestionVariables(question.uniqueId);

        return from(PollRoute.get(this.vote.formGuid)).pipe(
          switchMap((pollRoute) => {
            input.voterDetail = {
              elapsedTime: this.vote.timerCounter,
              guid: this.vote.formGuid,
              latitude: this.vote.userPosition?.lat ? this.vote.userPosition.lat : undefined,
              longitude: this.vote.userPosition?.lng ? this.vote.userPosition.lng : undefined,
              gpsAccuracy: this.vote.userPosition?.accuracyMeters,
              regionUniqueId: this.vote.lastRegionChildId,
              expressionActions: undefined,
              completionPercentage: this.vote.progressBarValue,
              pollRoute: pollRoute,
              voiceRecordFileIdUnique: [],
            };

            return this.dataService
              .post<boolean | null>(AppConsts.apiBaseUrl + AppConsts.serverApis.addOrUpdateQuestionAnswerDetails, input)
              .pipe(
                finalize(() => (question.loading = false)),
                map((resp) => {
                  question.saveSuccess = resp.success ? true : false;
                  return !!resp.success;
                }),
                catchError((err) => {
                  question.saveSuccess = false;
                  return of(false);
                }),
              );
          }),
        );
      }),
    );
  }

  private getQuestionVariables(formQuestionUniqueId: string) {
    let variables: any = {};
    const filterVariableList = this.vote.gvarList.filter((x) => x.formQuestionUniqueId == formQuestionUniqueId);
    for (let v of filterVariableList) {
      variables[v.title] = v.result;
    }
    return variables;
  }
}
