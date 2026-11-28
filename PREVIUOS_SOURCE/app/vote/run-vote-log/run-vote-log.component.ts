import { Component, inject, OnInit } from '@angular/core';
import { readJsonFile } from './read-json';
import { VoteComponent } from '../vote.component';
import { ConverterDataService } from '../services/converter-data.service';
import type { CreateVoterWithDetailsDto } from '@core/models/backend-dto/CreateVoterWithDetailsDto';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import type { QuestionModel } from '@core/models/QuestionModel';
import { cloneDeep } from 'lodash-es';
import type { GetFormQuestionAnswerDto } from '@core/models/backend-dto/voter-details/GetFormQuestionAnswerDto';
import type { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';
import type { CreateVoterAnswerDetailDto } from '@core/models/backend-dto/CreateVoterAnswerDetailDto';
import type { VoterAnswerDetailListAndSectionIdDto } from '@core/models/backend-dto/VoterAnswerDetailListAndSectionIdDto';
import type { GetAllFormDetailForViewOutputDto } from '@core/models/backend-dto/GetAllFormDetailForViewOutputDto';

@Component({
  standalone: false,
  selector: 'app-run-vote-log',
  templateUrl: './run-vote-log.component.html',
  styleUrls: ['./run-vote-log.component.scss', '../vote.component.scss'],
})
export class RunVoteLogComponent extends VoteComponent implements OnInit {
  formDataJson?: GetAllFormDetailForViewOutputDto;
  answerJson?: CreateVoterWithDetailsDto;
  currentLang = 'fa-IR';

  protected readonly converterDataServer = inject(ConverterDataService);

  override ngOnInit() {
    this.languageService.setPageLanguageAndDirection(this.currentLang);
  }

  onChangeLang() {
    this.languageService.setPageLanguageAndDirection(this.currentLang);
  }
  async onSelectFormDetail(ev: any) {
    this.answerJson = undefined;
    this.formDataJson = (await readJsonFile(ev)) as GetAllFormDetailForViewOutputDto;
    if (!this.formDataJson) {
      this.alert.show({ title: 'not data found!' });
      return;
    }
    console.log('formDataJson', this.formDataJson);
    this.formDataJson.canSubmit = false;
    this.formDataJson.poll.isRecordingEnable = false;
    await this.handleResponseGetAllFormDetailForView('', {
      result: this.formDataJson,
      responseHeader: {},
    });
  }
  async onSelectFilledAnswer(ev: any) {
    this.answerJson = (await readJsonFile(ev)) as CreateVoterWithDetailsDto;
    console.log('answerJson', this.answerJson);
    const voter = {
      formSections: (this.answerJson.formSections ?? []).map((section) => ({
        formSectionUniqueId: this.findFormSectionUniqueId(section),
        sectionLoopQuestionAnswerDetail: (section.repeatSections ?? []).map((repeatSection: any, index: number) => ({
          loopNumber: index + 1,
          sectionQuestionAnswerDetail: this.convertAnswersToQuestions(repeatSection.voterAnswerDetails ?? []),
          variables: repeatSection.variablesRepeatedSectionValue ?? {},
        })),
      })),
    } as unknown as GetVoterFullDetail;

    this.vote.timerCounter = this.answerJson.voterDetail?.elapsedTime ?? 0;

    return this.converterDataServer.loadSavedData(this.logicService, voter);
  }

  private findFormSectionUniqueId(section: VoterAnswerDetailListAndSectionIdDto): string {
    const firstQuestionId = section.repeatSections?.[0]?.voterAnswerDetails?.[0]?.formQuestionUniqueId;
    if (!firstQuestionId) return '';
    return this.vote.questionList.find((x) => x.uniqueId == firstQuestionId)?.formSectionUniqueId ?? '';
  }

  /**
   * گروه بندی پاسخ های ارسالی بر اساس شناسه سؤال
   * و تبدیل به ساختار GetFormQuestionAnswerDto
   */
  private convertAnswersToQuestions(answers: CreateVoterAnswerDetailDto[]): GetFormQuestionAnswerDto[] {
    const grouped = new Map<string, CreateVoterAnswerDetailDto[]>();

    for (const answer of answers) {
      const questionId = answer.formQuestionUniqueId;

      if (!questionId) {
        continue;
      }

      if (!grouped.has(questionId)) {
        grouped.set(questionId, []);
      }

      grouped.get(questionId)!.push(answer);
    }

    const result: GetFormQuestionAnswerDto[] = [];

    for (const [questionId, voterAnswerDetailDto] of grouped) {
      const question = this.vote.questionList.find((x) => x.uniqueId === questionId);

      if (!question) {
        continue;
      }

      result.push({
        uniqueId: questionId,
        questionType: question.questionType,
        hasDescription: question.hasDescription,
        voterAnswerDetailDto: voterAnswerDetailDto,
      } as any as GetFormQuestionAnswerDto);
    }

    return result;
  }
}
