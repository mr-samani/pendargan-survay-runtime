import { describe, expect, it } from 'vitest';
import { ExpressionActionsEnum, ExpressionTargetsEnum, FormExpressionTypeEnum, FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { ProposedSurveyAction } from '../definition/full-evaluator';
import { resolveEndedQuestionIds } from './end-form-projection';

function definition(): SurveyDefinition {
  const question = (id: string, sourceId: string, uniqueIdPerForm: string) => ({
    id, source: { uniqueId: sourceId }, sourceId, uniqueIdPerForm,
    questionType: FormQuestionTypesEnum.ShortText, formSectionUniqueId: 'section',
    isActive: true, isRequired: false, options: [], settings: null,
  });
  return {
    id: 'survey', sections: [{ id: 'section', source: {}, sourceId: 'section-db', uniqueIdPerForm: 'section' }],
    questions: [question('q1', 'db1', 'form1'), question('q2', 'db2', 'form2'), question('q3', 'db3', 'form3')],
    expressions: [], globalVariables: [],
  };
}
function action(actionType: ExpressionActionsEnum, ref: string, conditionMet = true): ProposedSurveyAction {
  return {
    expressionId: 'expression', formulaId: 'formula', actionType,
    targetType: ExpressionTargetsEnum.Question, formQuestionUniqueId: ref,
    formExpressionType: FormExpressionTypeEnum.InsideForm, value: conditionMet, conditionMet,
  };
}

describe('EndForm/SubmitForm serialization projection', () => {
  it.each([ExpressionActionsEnum.EndForm, ExpressionActionsEnum.SubmitForm])(
    'keeps the trigger question and ends only following questions for action %s',
    (actionType) => {
      const result = resolveEndedQuestionIds(definition(), [action(actionType, 'db2')]);
      expect([...result]).toEqual(['q3']);
      expect(result.has('q2')).toBe(false);
    },
  );

  it('resolves multiple active triggers to the earliest question in form order', () => {
    expect([...resolveEndedQuestionIds(definition(), [
      action(ExpressionActionsEnum.EndForm, 'db2'),
      action(ExpressionActionsEnum.SubmitForm, 'form1'),
    ])]).toEqual(['q2', 'q3']);
  });

  it('removes an ended trigger when its current condition is false', () => {
    expect([...resolveEndedQuestionIds(definition(), [
      action(ExpressionActionsEnum.EndForm, 'db1', false),
    ])]).toEqual([]);
  });

  it('ignores action references that no longer exist in the definition', () => {
    expect([...resolveEndedQuestionIds(definition(), [
      action(ExpressionActionsEnum.SubmitForm, 'deleted-question'),
    ])]).toEqual([]);
  });
});
