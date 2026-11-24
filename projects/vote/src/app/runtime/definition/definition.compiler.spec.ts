import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  FormQuestionTypesEnum,
  FormSectionTypeEnum,
  GetAllFormDetailForViewOutputDto,
  GetFormExpressionDto,
  GetFormGlobalVariableDto,
  GetFormQuestionQuestionOptionDto,
  GetFormSectionDto,
  GetQuestionOptionDto,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import { compileSurveyDefinition } from './definition.compiler';

describe('compileSurveyDefinition', () => {
  it('creates a detached, immutable definition and preserves source metadata', () => {
    const settings = { nested: { enabled: true }, labels: ['one', 'two'] };
    const response = new GetAllFormDetailForViewOutputDto({
      formGuid: 'form-guid',
      canSubmit: true,
      formSections: [
        new GetFormSectionDto({
          uniqueId: 'section-id',
          uniqueIdPerForm: 'section-key',
          type: FormSectionTypeEnum.Loop,
          loopNumber: 3,
          firstQuestionSortKey: 20,
        }),
      ],
      formQuestions: [
        new GetFormQuestionQuestionOptionDto({
          uniqueId: 'question-id',
          uniqueIdPerForm: 'question-key',
          questionType: FormQuestionTypesEnum.MultiSelect,
          formSectionUniqueId: 'section-key',
          sortKey: 20,
          isActive: true,
          isRequired: true,
          settings,
          questionOptions: [
            new GetQuestionOptionDto({
              uniqueId: 'option-id',
              uniqueIdPerForm: 'option-key',
              rowNumber: 2,
              title: 'Option',
              settings: { nested: { value: 7 } },
            }),
          ],
        }),
      ],
      formExpressions: [
        new GetFormExpressionDto({
          uniqueId: 'expression-id',
          expressionText: '@Q1 > 0',
          actionType: ExpressionActionsEnum.Show,
          targetType: ExpressionTargetsEnum.Question,
          formExpressionType: FormExpressionTypeEnum.InsideForm,
          isActive: true,
        }),
      ],
      formGlobalVariables: [
        new GetFormGlobalVariableDto({
          uniqueId: 'variable-id',
          title: 'Total',
          expression: '1 + 2',
          isActive: true,
        }),
      ],
    });

    const result = compileSurveyDefinition(response);

    expect(result.isValid).toBe(true);
    expect(result.definition.questions[0].id).toBe('question-key');
    expect(result.definition.questions[0].options[0].id).toBe('option-key');
    expect(result.definition.sections[0].type).toBe(FormSectionTypeEnum.Loop);
    expect(result.definition.expressions[0].actionType).toBe(ExpressionActionsEnum.Show);
    expect(result.definition.globalVariables[0].expression).toBe('1 + 2');
    expect(Object.isFrozen(result.definition)).toBe(true);
    expect(Object.isFrozen(result.definition.questions[0].options)).toBe(true);
    expect(Object.isFrozen(result.definition.questions[0].settings?.nested)).toBe(true);

    expect(Object.isFrozen(settings)).toBe(false);
    expect(settings.nested.enabled).toBe(true);
  });

  it('sorts definitions deterministically without mutating API arrays', () => {
    const first = new GetFormQuestionQuestionOptionDto({
      uniqueIdPerForm: 'later',
      sortKey: 20,
      questionType: FormQuestionTypesEnum.UniqueSelect,
    });
    const second = new GetFormQuestionQuestionOptionDto({
      uniqueIdPerForm: 'earlier',
      sortKey: 10,
      questionType: FormQuestionTypesEnum.UniqueSelect,
    });
    const source = [first, second];

    const result = compileSurveyDefinition(
      new GetAllFormDetailForViewOutputDto({ formQuestions: source }),
    );

    expect(result.definition.questions.map((question) => question.id)).toEqual([
      'earlier',
      'later',
    ]);
    expect(source[0]).toBe(first);
    expect(source[1]).toBe(second);
  });

  it('reports missing types and duplicate IDs instead of silently accepting ambiguity', () => {
    const result = compileSurveyDefinition(
      new GetAllFormDetailForViewOutputDto({
        formQuestions: [
          new GetFormQuestionQuestionOptionDto({
            uniqueIdPerForm: 'duplicate',
            questionType: FormQuestionTypesEnum.UniqueSelect,
          }),
          new GetFormQuestionQuestionOptionDto({
            uniqueIdPerForm: 'duplicate',
          }),
        ],
      }),
    );

    expect(result.isValid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'QUESTION_TYPE_MISSING',
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'DUPLICATE_DEFINITION_ID',
    );
  });

  it('uses explicit snapshot-local fallback IDs and reports them', () => {
    const result = compileSurveyDefinition(
      new GetAllFormDetailForViewOutputDto({
        formQuestions: [
          new GetFormQuestionQuestionOptionDto({
            questionType: FormQuestionTypesEnum.UniqueSelect,
          }),
        ],
      }),
    );

    expect(result.definition.questions[0].id).toBe('question:0');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'DEFINITION_ID_FALLBACK',
    );
  });
});
