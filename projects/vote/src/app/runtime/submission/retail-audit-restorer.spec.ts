import {
  FormQuestionTypesEnum,
  FormSectionLoopQuestionAnswerDto,
  GetFormQuestionAnswerDto,
  VoterAnswerDetailDto,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import { restoreRetailAuditAnswer } from './retail-audit-restorer';
import { serializeRetailAuditRows } from './retail-audit-submission-serializer';

function definition(): { definition: SurveyDefinition; retail: SurveyQuestionDefinition } {
  const retail: SurveyQuestionDefinition = {
    id: 'retail', source: { uniqueId: 'retail-db', dynamicDataUniqueId: 'products' },
    sourceId: 'retail-db', uniqueIdPerForm: 'retail-fid',
    questionType: FormQuestionTypesEnum.RetailAudit, formSectionUniqueId: 'section-fid',
    isActive: true, isRequired: false, options: [], settings: null,
  };
  const child: SurveyQuestionDefinition = {
    id: 'child', source: { uniqueId: 'child-db' }, sourceId: 'child-db',
    uniqueIdPerForm: 'child-fid', questionType: FormQuestionTypesEnum.Numeric,
    formSectionUniqueId: 'section-fid', isActive: true, isRequired: true,
    options: [], settings: null,
  };
  return {
    retail,
    definition: {
      id: 'survey',
      sections: [{ id: 'section', source: {}, sourceId: 'section-db', uniqueIdPerForm: 'section-fid' }],
      questions: [retail, child],
      expressions: [], globalVariables: [],
    },
  };
}
function page(id: number, title: string, childValue: string): FormSectionLoopQuestionAnswerDto {
  return new FormSectionLoopQuestionAnswerDto({
    loopNumber: id,
    voterVariables: [],
    sectionQuestionAnswerDetail: [
      new GetFormQuestionAnswerDto({
        uniqueId: 'retail-db', questionType: FormQuestionTypesEnum.RetailAudit,
        voterAnswerDetailDto: [new VoterAnswerDetailDto({
          dynamicDataRecordId: id, answerTitle: title, jsonValuesDictionary: { code: String(id) },
        })],
      }),
      new GetFormQuestionAnswerDto({
        uniqueId: 'child-db', questionType: FormQuestionTypesEnum.Numeric,
        voterAnswerDetailDto: childValue
          ? [new VoterAnswerDetailDto({ answerDescription: childValue })] : [],
      }),
    ],
  });
}

describe('restoreRetailAuditAnswer', () => {
  it('rebuilds each selected retail item with its child answers and validity', () => {
    const { definition: def, retail } = definition();
    const result = restoreRetailAuditAnswer(retail, def, [
      page(1, 'Product A', '5'),
      page(2, 'Product B', ''),
    ]);
    expect(result.answer.value).toMatchObject([
      {
        identificationCode: 1,
        answerTitle: 'Product A',
        dynamicDataUniqueId: 'products',
        jsonValuesDictionary: { code: '1' },
        formValid: true,
      },
      {
        identificationCode: 2,
        answerTitle: 'Product B',
        formValid: false,
      },
    ]);
    expect(result.hasSavedAnswer).toBe(true);
  });

  it('omits repeated pages without a RetailAudit row', () => {
    const { definition: def, retail } = definition();
    const result = restoreRetailAuditAnswer(retail, def, [
      new FormSectionLoopQuestionAnswerDto({ loopNumber: 1, sectionQuestionAnswerDetail: [], voterVariables: [] }),
    ]);
    expect(result.answer.value).toEqual([]);
    expect(result.hasSavedAnswer).toBe(false);
  });
  it('round-trips restored RetailAudit products into their legacy repeated-section answer rows', () => {
    const { definition: def, retail } = definition();
    const restored = restoreRetailAuditAnswer(retail, def, [page(7, 'Product Seven', '15')]);
    const submitted = serializeRetailAuditRows(retail, restored.answer, def, false);

    expect(submitted.repeatSections).toHaveLength(1);
    expect(submitted.repeatSections[0].voterAnswerDetails).toMatchObject([
      {
        formQuestionUniqueId: 'retail-db',
        dynamicDataRecordId: 7,
        answerTitle: 'Product Seven',
      },
      {
        formQuestionUniqueId: 'child-db',
        dynamicDataRecordId: 7,
        answerDescription: '15',
      },
    ]);
  });

  it('marks a product incomplete when a required nested matrix child is unanswered', () => {
    const base = definition();
    const matrix: SurveyQuestionDefinition = {
      id: 'matrix', source: { uniqueId: 'matrix-db' }, sourceId: 'matrix-db',
      uniqueIdPerForm: 'matrix-ref', questionType: FormQuestionTypesEnum.Matrix,
      formSectionUniqueId: 'section-fid', isActive: true, isRequired: false,
      options: [], settings: null,
    };
    const nestedChild: SurveyQuestionDefinition = {
      id: 'matrix-cell', source: { uniqueId: 'matrix-cell-db' }, sourceId: 'matrix-cell-db',
      uniqueIdPerForm: 'matrix-cell-ref', parentUniqueId: 'matrix-db',
      questionType: FormQuestionTypesEnum.Numeric, formSectionUniqueId: 'section-fid',
      isActive: true, isRequired: true, options: [], settings: null,
    };
    const def: SurveyDefinition = {
      ...base.definition,
      questions: [...base.definition.questions, matrix, nestedChild],
    };
    const savedPage = new FormSectionLoopQuestionAnswerDto({
      loopNumber: 1,
      voterVariables: [],
      sectionQuestionAnswerDetail: [
        new GetFormQuestionAnswerDto({
          uniqueId: 'retail-db', questionType: FormQuestionTypesEnum.RetailAudit,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ dynamicDataRecordId: 5, answerTitle: 'Product' })],
        }),
        new GetFormQuestionAnswerDto({
          uniqueId: 'matrix-db', questionType: FormQuestionTypesEnum.Matrix, voterAnswerDetailDto: [],
        }),
        new GetFormQuestionAnswerDto({
          uniqueId: 'matrix-cell-db', questionType: FormQuestionTypesEnum.Numeric, voterAnswerDetailDto: [],
        }),
      ],
    });

    const result = restoreRetailAuditAnswer(base.retail, def, [savedPage]);
    expect(result.answer.value).toMatchObject([{
      formValid: false,
      questionChilds: [{
        questionId: 'matrix-db',
        questionChilds: [{ questionId: 'matrix-cell-db', answer: null }],
      }],
    }]);
    const roundTrip = serializeRetailAuditRows(base.retail, result.answer, def, true);
    expect(roundTrip.repeatSections[0].voterAnswerDetails).toHaveLength(2);
    expect(roundTrip.repeatSections[0].voterAnswerDetails?.[1]).toMatchObject({
      formQuestionUniqueId: 'matrix-cell-db',
    });
  });

});