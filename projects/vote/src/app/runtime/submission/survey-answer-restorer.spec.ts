import {
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  FormQuestionTypesEnum,
  FormSectionTypeEnum,
  FormSectionQuestionAnswerDto,
  FormSectionLoopQuestionAnswerDto,
  GetFormQuestionAnswerDto,
  GetTempVoterForLoadDto,
  GetVoterFullDetail,
  VoterAnswerDetailDto,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyDefinition } from '../definition/definition.types';
import { restoreSurveyFromBackend } from './survey-answer-restorer';

function definition(isPopup = false): SurveyDefinition {
  return {
    id: 'survey',
    sections: [{
      id: 'section', source: { isPopUp: isPopup }, sourceId: 'section-db',
      uniqueIdPerForm: 'section-fid', type: FormSectionTypeEnum.Normal, isPopUp: isPopup,
    }],
    questions: [{
      id: 'q', source: { uniqueId: 'q-db' }, sourceId: 'q-db',
      uniqueIdPerForm: 'q-fid', questionType: FormQuestionTypesEnum.Numeric,
      formSectionUniqueId: 'section-fid', isActive: true, isRequired: false,
      options: [], settings: null,
    }],
    expressions: [{
      id: 'loop', source: {}, expressionText: 'true',
      targetType: ExpressionTargetsEnum.SectionLoop, targetKey: 'section-fid',
      formExpressionType: FormExpressionTypeEnum.InsideForm, isActive: true,
    }],
    globalVariables: [],
  };
}
function savedPage(loopNumber: number, value: string): FormSectionLoopQuestionAnswerDto {
  return new FormSectionLoopQuestionAnswerDto({
    loopNumber,
    sectionQuestionAnswerDetail: [new GetFormQuestionAnswerDto({
      uniqueId: 'q-db',
      questionType: FormQuestionTypesEnum.Numeric,
      voterAnswerDetailDto: [new VoterAnswerDetailDto({ answerDescription: value })],
    })],
    voterVariables: [],
  });
}
function voter(pages: FormSectionLoopQuestionAnswerDto[]): GetVoterFullDetail {
  return new GetVoterFullDetail({
    formSections: [new FormSectionQuestionAnswerDto({
      formSectionUniqueId: 'section-fid',
      sectionLoopQuestionAnswerDetail: pages,
    })],
  });
}

describe('restoreSurveyFromBackend', () => {
  it('restores non-popup loop pages into isolated instances with zero-based indexes', () => {
    const result = restoreSurveyFromBackend(
      definition(),
      voter([savedPage(1, 'first'), savedPage(2, 'second')]),
      new GetTempVoterForLoadDto({ elapsedTime: 45, completePercentage: 50 }),
    );
    expect(result.isValid).toBe(true);
    expect(result.elapsedTime).toBe(45);
    expect(result.completionPercentage).toBe(50);
    expect(result.answerState.instances['root']['q'].value).toBe('first');
    expect(result.answerState.instances['loop:section:1']['q'].value).toBe('second');
    expect(result.loopRuntime.sections['section'].currentIterationIndex).toBe(1);
    expect(result.loopRuntime.sections['section'].iterations.map((item) => item.backendLoopNumber)).toEqual([1, 2]);
    expect(result.loopRuntime.sections['section'].iterations.every((item) => !item.isFilled)).toBe(true);
  });

  it('marks restored iterations filled for popup sections, matching the legacy loader', () => {
    const result = restoreSurveyFromBackend(
      definition(true),
      voter([savedPage(1, 'first'), savedPage(2, 'second')]),
    );
    expect(result.loopRuntime.sections['section'].iterations.every((item) => item.isFilled)).toBe(true);
  });

  it('rejects non-contiguous backend loop numbers instead of misassigning answers', () => {
    const result = restoreSurveyFromBackend(
      definition(),
      voter([savedPage(1, 'first'), savedPage(3, 'third')]),
    );
    expect(result.isValid).toBe(false);
    expect(result.diagnostics[0].code).toBe('RESTORE_LOOP_NUMBER_NOT_CONTIGUOUS');
  });

  it('reports saved sections that no longer exist in the definition', () => {
    const data = voter([savedPage(1, 'first')]);
    data.formSections[0].formSectionUniqueId = 'deleted-section';
    const result = restoreSurveyFromBackend(definition(), data);
    expect(result.diagnostics[0].code).toBe('RESTORE_SECTION_NOT_IN_DEFINITION');
    expect(result.isValid).toBe(true);
  });
});
