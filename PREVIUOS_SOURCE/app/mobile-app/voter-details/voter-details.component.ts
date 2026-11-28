import { Component, Injector, Input, OnInit } from '@angular/core';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { AppConsts } from '@core/app-consts';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { validationAdditionalSettings } from '@app/vote/helpers/additional-settings-validate';
import { FormGlobalVariableTypeEnum } from '@core/models/backend-dto/FormGlobalVariableTypeEnum';
import { FormSectionQuestionAnswerDto } from '@core/models/backend-dto/voter-details/FormSectionQuestionAnswerDto';
import { GetVoterForViewDto } from '@core/models/backend-dto/voter-details/GetVoterForViewDto';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';
import { VoterVariableDto } from '@core/models/backend-dto/VoterVariableDto';
import { VoterDetailsResponseAndHeader } from './voter-details.model';
import { VoterAndFormQuestionFilesLimitedDto } from '@core/models/backend-dto/voter-details/VoterAndFormQuestionFilesLimitedDto';
export class VoterFormSection extends FormSectionQuestionAnswerDto {
  activeIndex?: number;
}

@Component({
  standalone: false,
  selector: 'app-voter-details',
  templateUrl: './voter-details.component.html',
  styleUrls: ['./voter-details.component.scss'],
})
export class VoterDetailsComponent extends MobileAppBaseComponent implements OnInit {
  isDialog = false;
  @Input() set data(val: GetVoterFullDetail) {
    this.init({ result: val, responseHeader: {} });
    this.isDialog = true;
  }
  showHighlightedQuestions = true;

  voiceRecoredFile: VoterAndFormQuestionFilesLimitedDto[] = [];
  voterDetails?: GetVoterForViewDto;
  formSections: VoterFormSection[] = [];
  pollTitle = '';
  baseUrl = AppConsts.fileServerUrl;
  constructor(injector: Injector) {
    super(injector);
    if (this.route.snapshot.data['data']) {
      this.init(this.route.snapshot.data['data']);
    }
  }

  ngOnInit(): void {}

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }

  init(response: VoterDetailsResponseAndHeader) {
    console.log('Initializing voter details component with response:', response);
    const { result, responseHeader } = response;
    this.baseUrl =
      responseHeader && responseHeader['x-file-base-url'] ? responseHeader['x-file-base-url'] : AppConsts.fileServerUrl;

    this.voterDetails = result.voterDetail;
    this.formSections = result.formSections ?? [];
    // init
    for (let m of this.formSections) {
      m.activeIndex = 0;
      for (let section of m.sectionLoopQuestionAnswerDetail) {
        section.sectionQuestionAnswerDetail.map((question) => {
          question.settings = validationAdditionalSettings(question.questionType, question.settings);
          if (question.questionOptionDto && question.questionOptionDto.length) {
            question.questionOptionDto.forEach((o) => {
              o.settings = validationAdditionalSettings(question.questionType, o.settings);
            });
          }
          if (
            question.questionType == FormQuestionTypesEnum.Matrix ||
            question.questionType == FormQuestionTypesEnum.Matrix_Dynamic
          ) {
            (question as any).questionChild = section.sectionQuestionAnswerDetail.filter(
              (x) => x.parentUniqueId == question.uniqueId,
            );
          }
        });
      }
    }

    // this.demographyData = result.voterDetail.demographyData;
    this.setVariableResultInTitle();
    this.voiceRecoredFile = result.voterDetail?.voiceRecoredFiles ?? [];
    if (!AppConsts.isMobile) {
      for (let voice of this.voiceRecoredFile) {
        voice.addressUrl = AppConsts.remoteBaseUrl + '/' + voice.addressUrl;
      }
    }

    this.pollTitle =
      result.voterDetail.pollTitle != ''
        ? result.voterDetail.pollTitle
        : this.translateService.instant('ViewVoteDetails');
    this.headerService.headerTitle = this.pollTitle;
  }

  setVariableResultInTitle() {
    console.time('Fill variable result in titles');
    for (let section of this.formSections) {
      for (let sectionLoop of section.sectionLoopQuestionAnswerDetail) {
        if (
          !sectionLoop.voterVariables ||
          sectionLoop.voterVariables.length === 0 ||
          !sectionLoop.sectionQuestionAnswerDetail
        ) {
          continue;
        }
        for (let item of sectionLoop.sectionQuestionAnswerDetail) {
          for (let v of sectionLoop.voterVariables) {
            item.title = item.title?.split('[%' + v.name + '%]').join(this.getVariableResult(v));
          }
          //}
          // answer title
          if (item.questionOptionDto) {
            for (let opt of item.questionOptionDto) {
              for (let v of sectionLoop.voterVariables) {
                opt.title = opt.title?.split('[%' + v.name + '%]').join(this.getVariableResult(v));
              }
            }
          }
        }
      }
    }
    console.timeEnd('Fill variable result in titles');
  }

  getVariableResult(variable: VoterVariableDto) {
    try {
      const defaultImg = 'assets/images/no-image.png';
      const defaultImgAvatar = 'assets/images/avatar.jpg';
      let variableResult: any = '';
      switch (variable.type) {
        case FormGlobalVariableTypeEnum.ImageString:
          variableResult =
            isNullOrEmpty(variable.value) == false ? `data:image/png;base64,${variable.value}` : defaultImgAvatar;
          break;
        case FormGlobalVariableTypeEnum.ImageProfileFile:
          variableResult =
            isNullOrEmpty(variable.value) == false
              ? AppConsts.profilePictureUrl + '?TenantId=' + AppConsts.tenantId + '&ProfilePictureId=' + variable.value
              : defaultImgAvatar;
          break;
        case FormGlobalVariableTypeEnum.ImageFile:
          if (variable.value) {
            let fileGuidList = JSON.parse(variable.value);
            variableResult =
              fileGuidList.length > 0 && isNullOrEmpty(fileGuidList[0]) == false
                ? AppConsts.fileServerUrl + '/' + fileGuidList[0]
                : defaultImg;
          }
          break;
        default:
          variableResult =
            '<span class="text-variable">' + (!isNullOrEmpty(variable.value) ? variable.value : '') + '</span>';
          break;
      }
      return variableResult;
    } catch (error) {
      return '';
    }
  }
}
