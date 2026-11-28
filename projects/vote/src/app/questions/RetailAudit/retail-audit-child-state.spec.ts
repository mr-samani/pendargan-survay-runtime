import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { QuestionModel } from '../models/question';
import { buildRetailAuditChildTree, flattenRetailAuditChildRows, updateRetailAuditChildAnswer, validateRetailAuditChildTree } from './retail-audit-child-state';
function question(uniqueId: string, parentUniqueId: string | null, questionType: FormQuestionTypesEnum): QuestionModel {
  return { uniqueId, uniqueIdPerForm: uniqueId + '-form', parentUniqueId, questionType, title: uniqueId, isRequired: true, isActive: true, questionOptions: [], runtimeEndForm: () => false } as unknown as QuestionModel;
}
describe('RetailAudit isolated child-answer state', () => {
  it('builds nested Group/Matrix descendants and keeps edits immutable', () => {
    const root = question('retail', null, FormQuestionTypesEnum.RetailAudit);
    const group = question('group', 'retail', FormQuestionTypesEnum.Group);
    const matrix = question('matrix', 'group', FormQuestionTypesEnum.Matrix);
    const leaf = question('leaf', 'matrix', FormQuestionTypesEnum.ShortText);
    const tree = buildRetailAuditChildTree(root, [group, matrix, leaf]);
    expect(flattenRetailAuditChildRows(tree).map((row) => row.node.questionId)).toEqual(['group-form', 'matrix-form', 'leaf-form']);
    const next = updateRetailAuditChildAnswer(tree, 'leaf-form', 'first product');
    expect(next).not.toBe(tree);
    expect(tree[0].questionChilds[0].questionChilds[0].answer).toBeNull();
    expect(next[0].questionChilds[0].questionChilds[0].answer).toBe('first product');
  });
  it('restores nested saved child answers into the matching product tree only', () => {
    const root = question('retail', null, FormQuestionTypesEnum.RetailAudit);
    const group = question('group', 'retail', FormQuestionTypesEnum.Group);
    const leaf = question('leaf', 'group', FormQuestionTypesEnum.Numeric);
    const first = buildRetailAuditChildTree(root, [group, leaf], [{ questionId: 'group-form', answer: null, selectedOptionIds: [], questionChilds: [{ questionId: 'leaf-form', answer: 12, selectedOptionIds: [] }] }]);
    const second = buildRetailAuditChildTree(root, [group, leaf], [{ questionId: 'group-form', answer: null, selectedOptionIds: [], questionChilds: [{ questionId: 'leaf-form', answer: 3, selectedOptionIds: [] }] }]);
    expect(first[0].questionChilds[0].answer).toBe(12);
    expect(second[0].questionChilds[0].answer).toBe(3);
    expect(first[0].questionChilds[0]).not.toBe(second[0].questionChilds[0]);
  });
  it('validates required leaves while ignoring container questions', () => {
    const root = question('retail', null, FormQuestionTypesEnum.RetailAudit);
    const group = question('group', 'retail', FormQuestionTypesEnum.Group);
    const leaf = question('leaf', 'group', FormQuestionTypesEnum.ShortText);
    const optional = { ...question('optional', 'group', FormQuestionTypesEnum.ShortText), isRequired: false } as QuestionModel;
    const tree = buildRetailAuditChildTree(root, [group, leaf, optional]);
    expect(validateRetailAuditChildTree(tree)).toBeUndefined();
    const changed = updateRetailAuditChildAnswer(tree, 'leaf-form', 'ok');
    expect(validateRetailAuditChildTree(changed)).toBe(true);
    const partiallyAnswered = updateRetailAuditChildAnswer(changed, 'optional-form', 'optional value');
    expect(validateRetailAuditChildTree(updateRetailAuditChildAnswer(partiallyAnswered, 'leaf-form', null))).toBe(false);
  });

  it('hides and validates required child questions ended by the current runtime projection', () => {
    const root = question('retail', null, FormQuestionTypesEnum.RetailAudit);
    const endedLeaf = {
      ...question('ended', 'retail', FormQuestionTypesEnum.ShortText),
      runtimeEndForm: () => true,
    } as unknown as QuestionModel;
    const tree = buildRetailAuditChildTree(root, [endedLeaf]);
    expect(flattenRetailAuditChildRows(tree)).toEqual([]);
    expect(validateRetailAuditChildTree(tree)).toBe(true);
  });

});
