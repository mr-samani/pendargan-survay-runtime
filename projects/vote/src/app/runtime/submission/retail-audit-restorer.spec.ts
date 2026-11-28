import {
  FormQuestionTypesEnum,
  FormSectionLoopQuestionAnswerDto,
  GetFormQuestionAnswerDto,
  VoterAnswerDetailDto,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { QuestionAnswerState } from '../state/answer-state.types';
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
    expect(JSON.stringify(submitted.repeatSections)).not.toContain('retailAuditItemId');
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

  it('treats a selected required choice option as a completed RetailAudit child answer', () => {
    const base = definition();
    const choice: SurveyQuestionDefinition = {
      id: 'choice', source: { uniqueId: 'choice-db' }, sourceId: 'choice-db',
      uniqueIdPerForm: 'choice-ref', questionType: FormQuestionTypesEnum.UniqueSelect,
      formSectionUniqueId: 'section-fid', isActive: true, isRequired: true,
      options: [{
        id: 'choice-option', source: { uniqueId: 'choice-option-db' },
        sourceId: 'choice-option-db', uniqueIdPerForm: 'choice-option-ref',
        title: 'Yes', settings: null,
      }], settings: null,
    };
    const def: SurveyDefinition = {
      ...base.definition,
      questions: [...base.definition.questions, choice],
    };
    const savedPage = new FormSectionLoopQuestionAnswerDto({
      loopNumber: 1,
      voterVariables: [],
      sectionQuestionAnswerDetail: [
        new GetFormQuestionAnswerDto({
          uniqueId: 'retail-db', questionType: FormQuestionTypesEnum.RetailAudit,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ dynamicDataRecordId: 6, answerTitle: 'Product' })],
        }),
        new GetFormQuestionAnswerDto({
          uniqueId: 'choice-db', questionType: FormQuestionTypesEnum.UniqueSelect,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ questionOptionUniqueId: 'choice-option-db' })],
        }),
      ],
    });

    const result = restoreRetailAuditAnswer(base.retail, def, [savedPage]);
    expect(result.answer.value).toMatchObject([{ formValid: true }]);
  });


  it('restores and serializes three-level Matrix/Group descendants exactly once', () => {
    const base = definition();
    const matrix: SurveyQuestionDefinition = {
      id: 'matrix', source: { uniqueId: 'matrix-db' }, sourceId: 'matrix-db',
      uniqueIdPerForm: 'matrix-ref', questionType: FormQuestionTypesEnum.Matrix,
      parentUniqueId: 'retail-db', formSectionUniqueId: 'section-fid',
      isActive: true, isRequired: false, options: [], settings: null,
    };
    const group: SurveyQuestionDefinition = {
      id: 'group', source: { uniqueId: 'group-db' }, sourceId: 'group-db',
      uniqueIdPerForm: 'group-ref', questionType: FormQuestionTypesEnum.Group,
      parentUniqueId: 'matrix-db', formSectionUniqueId: 'section-fid',
      isActive: true, isRequired: false, options: [], settings: null,
    };
    const leaf: SurveyQuestionDefinition = {
      id: 'leaf', source: { uniqueId: 'leaf-db' }, sourceId: 'leaf-db',
      uniqueIdPerForm: 'leaf-ref', questionType: FormQuestionTypesEnum.Numeric,
      parentUniqueId: 'group-db', formSectionUniqueId: 'section-fid',
      isActive: true, isRequired: true, options: [], settings: null,
    };
    const def: SurveyDefinition = {
      ...base.definition,
      questions: [...base.definition.questions, matrix, group, leaf],
    };
    const savedPage = new FormSectionLoopQuestionAnswerDto({
      loopNumber: 1,
      voterVariables: [],
      sectionQuestionAnswerDetail: [
        new GetFormQuestionAnswerDto({
          uniqueId: 'retail-db', questionType: FormQuestionTypesEnum.RetailAudit,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ dynamicDataRecordId: 9, answerTitle: 'Nested product' })],
        }),
        new GetFormQuestionAnswerDto({ uniqueId: 'matrix-db', questionType: FormQuestionTypesEnum.Matrix }),
        new GetFormQuestionAnswerDto({ uniqueId: 'group-db', questionType: FormQuestionTypesEnum.Group }),
        new GetFormQuestionAnswerDto({
          uniqueId: 'leaf-db', questionType: FormQuestionTypesEnum.Numeric,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ answerDescription: '42' })],
        }),
      ],
    });

    const restored = restoreRetailAuditAnswer(base.retail, def, [savedPage]);
    expect(restored.answer.value).toMatchObject([{
      formValid: true,
      questionChilds: [{
        questionId: 'matrix-db',
        questionChilds: [{
          questionId: 'group-db',
          questionChilds: [{ questionId: 'leaf-db', answer: '42' }],
        }],
      }],
    }]);

    const submitted = serializeRetailAuditRows(base.retail, restored.answer, def, false);
    const leaves = submitted.repeatSections[0].voterAnswerDetails?.filter((item) =>
      item.formQuestionUniqueId === 'leaf-db');
    expect(leaves).toHaveLength(1);
    expect(submitted.repeatSections[0].voterAnswerDetails).toHaveLength(2);
  });


  it('keeps duplicate product records as separate repeated sections with independent child answers and variables', () => {
    const { definition: def, retail } = definition();
    const child = (answer: number) => ({
      questionId: 'child-db',
      questionType: FormQuestionTypesEnum.Numeric,
      answer,
      isActive: true,
      isRequired: true,
      dontShow: false,
      endForm: false,
      hasVisibleQuestionOrOption: true,
      questionChilds: [],
    });
    const answerState: QuestionAnswerState = {
      questionId: retail.id,
      value: [
        {
          identificationCode: 55, answerTitle: 'Same product',
          retailAuditItemId: 'retail-row-1', formValid: true,
          questionChilds: [child(11)], retaliVariables: { store: 'north' },
        },
        {
          identificationCode: 55, answerTitle: 'Same product',
          retailAuditItemId: 'retail-row-2', formValid: true,
          questionChilds: [child(22)], retaliVariables: { store: 'south' },
        },
      ],
      selectedOptionIds: [],
      isDirty: true,
      updatedAtRevision: 4,
    };

    const submitted = serializeRetailAuditRows(retail, answerState, def, false);

    expect(submitted.repeatSections).toHaveLength(2);
    expect(submitted.repeatSections.map((section) =>
      section.voterAnswerDetails?.[1]?.answerDescription)).toEqual(['11', '22']);
    expect(submitted.repeatSections.map((section) =>
      section.variablesRepeatedSectionValue)).toEqual([{ store: 'north' }, { store: 'south' }]);
    expect(submitted.variablesLastValue).toEqual({ store: 'south' });
    expect(JSON.stringify(submitted.repeatSections)).not.toContain('retail-row-1');
    expect(JSON.stringify(submitted.repeatSections)).not.toContain('retail-row-2');
  });


  it('restores Matrix_Dynamic product descendants and serializes only the leaf cell answer', () => {
    const base = definition();
    const matrix: SurveyQuestionDefinition = {
      id: 'matrix-dynamic',
      source: { uniqueId: 'matrix-dynamic-db' },
      sourceId: 'matrix-dynamic-db',
      uniqueIdPerForm: 'matrix-dynamic-ref',
      questionType: FormQuestionTypesEnum.Matrix_Dynamic,
      parentUniqueId: 'retail-db',
      formSectionUniqueId: 'section-fid',
      isActive: true,
      isRequired: false,
      options: [],
      settings: null,
    };
    const cell: SurveyQuestionDefinition = {
      id: 'dynamic-cell',
      source: { uniqueId: 'dynamic-cell-db' },
      sourceId: 'dynamic-cell-db',
      uniqueIdPerForm: 'dynamic-cell-ref',
      questionType: FormQuestionTypesEnum.Numeric,
      parentUniqueId: 'matrix-dynamic-db',
      formSectionUniqueId: 'section-fid',
      isActive: true,
      isRequired: true,
      options: [],
      settings: null,
    };
    const def: SurveyDefinition = {
      ...base.definition,
      questions: [...base.definition.questions, matrix, cell],
    };
    const savedPage = new FormSectionLoopQuestionAnswerDto({
      loopNumber: 3,
      voterVariables: [],
      sectionQuestionAnswerDetail: [
        new GetFormQuestionAnswerDto({
          uniqueId: 'retail-db',
          questionType: FormQuestionTypesEnum.RetailAudit,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ dynamicDataRecordId: 44, answerTitle: 'Matrix product' })],
        }),
        new GetFormQuestionAnswerDto({
          uniqueId: 'matrix-dynamic-db',
          questionType: FormQuestionTypesEnum.Matrix_Dynamic,
          voterAnswerDetailDto: [],
        }),
        new GetFormQuestionAnswerDto({
          uniqueId: 'dynamic-cell-db',
          questionType: FormQuestionTypesEnum.Numeric,
          voterAnswerDetailDto: [new VoterAnswerDetailDto({ answerDescription: '7' })],
        }),
      ],
    });

    const restored = restoreRetailAuditAnswer(base.retail, def, [savedPage]);
    expect(restored.answer.value).toMatchObject([{
      formValid: true,
      questionChilds: [{
        questionId: 'matrix-dynamic-db',
        questionChilds: [{ questionId: 'dynamic-cell-db', answer: '7' }],
      }],
    }]);

    const submitted = serializeRetailAuditRows(base.retail, restored.answer, def, false);
    expect(submitted.repeatSections[0].voterAnswerDetails).toHaveLength(2);
    expect(submitted.repeatSections[0].voterAnswerDetails?.[1]).toMatchObject({
      formQuestionUniqueId: 'dynamic-cell-db',
      dynamicDataRecordId: 44,
      answerDescription: '7',
    });
  });


  it('ignores required child questions that are hidden, inactive or already ended', () => {
    const base = definition();
    const cases: readonly SurveyQuestionDefinition[] = [
      { ...base.definition.questions[1]!, isRequired: true, source: { uniqueId: 'child-db', dontShow: true } },
      { ...base.definition.questions[1], isRequired: true, isActive: false },
      { ...base.definition.questions[1], isRequired: true, source: { uniqueId: 'child-db', endForm: true } },
    ];
    for (const child of cases) {
      const def: SurveyDefinition = { ...base.definition, questions: [base.retail, child] };
      const result = restoreRetailAuditAnswer(base.retail, def, [page(11, 'Product', '')]);
      expect(result.answer.value).toMatchObject([{ formValid: true }]);
    }
  });

  it('reports deleted child definitions and does not recreate their answers on resubmission', () => {
    const base = definition();
    const def: SurveyDefinition = { ...base.definition, questions: [base.retail] };
    const restored = restoreRetailAuditAnswer(base.retail, def, [page(12, 'Product', '7')]);
    expect(restored.diagnostics.map((item) => item.code)).toContain('RESTORE_RETAIL_CHILD_NOT_IN_DEFINITION');
    expect(restored.answer.value).toMatchObject([{ formValid: true, questionChilds: [] }]);
    const submitted = serializeRetailAuditRows(base.retail, restored.answer, def, false);
    expect(submitted.repeatSections[0].voterAnswerDetails).toHaveLength(1);
    expect(submitted.repeatSections[0].voterAnswerDetails?.[0]).toMatchObject({
      formQuestionUniqueId: 'retail-db', dynamicDataRecordId: 12,
    });
  });

  it('assigns distinct internal row IDs to duplicate restored product records', () => {
    const { definition: def, retail } = definition();
    const result = restoreRetailAuditAnswer(retail, def, [
      page(13, 'Duplicate product A', '1'),
      page(13, 'Duplicate product B', '2'),
    ]);
    const items = result.answer.value as unknown as readonly Record<string, unknown>[];
    expect(items.map((item) => item['retailAuditItemId']))
      .toEqual(['retail:restored:0', 'retail:restored:1']);
    expect(items[0]?.['retailAuditItemId']).not.toBe(items[1]?.['retailAuditItemId']);
  });


  it('omits RetailAudit child answers after an EndForm/SubmitForm trigger', () => {
    const base = definition();
    const secondChild: SurveyQuestionDefinition = {
      id: 'second-child', source: { uniqueId: 'second-child-db' },
      sourceId: 'second-child-db', uniqueIdPerForm: 'second-child-ref',
      questionType: FormQuestionTypesEnum.Numeric, parentUniqueId: 'retail-db',
      formSectionUniqueId: 'section-fid', isActive: true, isRequired: true,
      options: [], settings: null,
    };
    const def: SurveyDefinition = {
      ...base.definition,
      questions: [...base.definition.questions, secondChild],
    };
    const answer: QuestionAnswerState = {
      questionId: base.retail.id,
      value: [{
        identificationCode: 21, answerTitle: 'Product', formValid: true,
        questionChilds: [
          { questionId: 'child-db', answer: '5', selectedOptionIds: [], isActive: true, dontShow: false, endForm: false, questionChilds: [] },
          { questionId: 'second-child-db', answer: null, selectedOptionIds: [], isActive: true, dontShow: false, endForm: false, questionChilds: [] },
        ],
        retaliVariables: {},
      }],
      selectedOptionIds: [], isDirty: false, updatedAtRevision: 0,
    };
    const submitted = serializeRetailAuditRows(
      base.retail, answer, def, false, new Set(['second-child']),
    );
    expect(submitted.repeatSections[0].voterAnswerDetails).toMatchObject([
      { formQuestionUniqueId: 'retail-db' },
      { formQuestionUniqueId: 'child-db', answerDescription: '5' },
    ]);
    expect(submitted.repeatSections[0].voterAnswerDetails?.some((item) =>
      item.formQuestionUniqueId === 'second-child-db')).toBe(false);
  });

});