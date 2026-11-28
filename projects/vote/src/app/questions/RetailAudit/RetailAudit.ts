import { Component, Injector, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import type { QuestionModel } from '../models/question';
import type { AnswerValue } from '../../runtime/state/answer-state.types';
import { DynamicDataHttpLoader, type DynamicDataOption } from '../../runtime/data/dynamic-data-http-loader';
import { DynamicDataRendererController, type DynamicDataRendererSnapshot } from '../../runtime/data/dynamic-data-renderer-controller';
import type { RetailAuditItemState } from '../../runtime/data/dynamic-data-question-runtime';
import { DynamicDataRefreshCoordinator } from '../../runtime/data/dynamic-data-refresh-coordinator';
import {
  buildRetailAuditChildTree, flattenRetailAuditChildRows, isRetailAuditChildChoice,
  isRetailAuditChildEditorSupported, isRetailAuditChildInputType, isRetailAuditChildLongText,
  isRetailAuditChildMultiChoice, updateRetailAuditChildAnswer, validateRetailAuditChildTree,
  type RetailAuditChildNode,
} from './retail-audit-child-state';

type RetailAuditQuestionModel = QuestionModel & {
  answer?: readonly RetailAuditItemState[] | null;
  selectedList?: readonly RetailAuditItemState[];
};

@Component({
  selector: 'question-retail-audit',
  imports: [QuestionSharedModule],
  templateUrl: './RetailAudit.html',
  styleUrl: './RetailAudit.scss',
})
export class RetailAudit extends QuestionBase implements OnInit, OnDestroy {
  private readonly loader = inject(DynamicDataHttpLoader);
  private readonly refreshCoordinator = inject(DynamicDataRefreshCoordinator);
  private readonly injector = inject(Injector);
  private controller?: DynamicDataRendererController;
  private snapshotSubscription?: Subscription;
  private controllerInstanceId?: string;
  private lastFieldFilter = '';
  private readonly controllerVersion = signal(0);
  private readonly childDefinitionsRevision = signal(0);

  readonly snapshot = signal<DynamicDataRendererSnapshot | null>(null);
  readonly searchText = signal('');
  readonly configurationError = signal<string | null>(null);
  readonly activeEditor = signal<{ readonly itemId: string; readonly title: string } | null>(null);
  readonly editorDraft = signal<readonly RetailAuditChildNode[] | null>(null);
  readonly editorRows = computed(() => flattenRetailAuditChildRows(this.editorDraft() ?? []));
  readonly editorCanSave = computed(() => this.editorRows().every((row) =>
    isRetailAuditChildEditorSupported(row.node)));
  readonly formQuestionTypes = FormQuestionTypesEnum;

  private readonly filterEffect = effect(() => {
    const question = this.question();
    const instanceId = this.vote.activeRuntimeAnswerInstanceId();
    const fieldFilter = question.effectiveFieldValueFilter();
    question.runtimeEffectRevision();
    this.controllerVersion();
    this.childDefinitionsRevision();
    if (!this.controller) return;
    if (instanceId !== this.controllerInstanceId) {
      this.bindController(question, instanceId);
      return;
    }
    if (fieldFilter !== this.lastFieldFilter) {
      this.lastFieldFilter = fieldFilter;
      this.controller.refreshFilter(fieldFilter);
    }
  }, { injector: this.injector });

  ngOnInit(): void {
    this.bindController(this.question(), this.vote.activeRuntimeAnswerInstanceId());
  }
  ngOnDestroy(): void {
    this.snapshotSubscription?.unsubscribe();
    this.filterEffect.destroy();
  }
  search(value: string): void {
    if (this.disabled()) return;
    this.searchText.set(value);
    this.controller?.search(value, this.question().effectiveFieldValueFilter());
  }
  add(option: DynamicDataOption): void {
    if (this.disabled()) return;
    this.controller?.addRetailAuditProduct(option);
    this.searchText.set('');
  }
  canSelect(option: DynamicDataOption): boolean {
    const selected = this.snapshot()?.selectedRetailAuditItems ?? [];
    return this.question().settings?.['canSelectDuplicateItems'] === true ||
      !selected.some((item) => String(item.identificationCode) === String(option.identificationCode));
  }
  remove(item: RetailAuditItemState): void {
    if (this.disabled()) return;
    this.controller?.removeRetailAuditProduct(item.retailAuditItemId);
    if (this.activeEditor()?.itemId === item.retailAuditItemId) this.cancelEditor();
  }
  openEditor(item: RetailAuditItemState): void {
    if (this.disabled()) return;
    const children = buildRetailAuditChildTree(this.question(), this.vote.questions, item.questionChilds);
    this.activeEditor.set({ itemId: item.retailAuditItemId, title: item.answerTitle ?? '' });
    this.editorDraft.set(children);
  }
  cancelEditor(): void {
    this.activeEditor.set(null);
    this.editorDraft.set(null);
  }
  updateText(questionId: string, value: string): void {
    const node = this.editorRows().find((row) => row.node.questionId === questionId)?.node;
    if (!node) return;
    const numeric = [FormQuestionTypesEnum.Numeric, FormQuestionTypesEnum.Point,
      FormQuestionTypesEnum.Point_NumericScale, FormQuestionTypesEnum.NPS,
      FormQuestionTypesEnum.Rating, FormQuestionTypesEnum.Matrix_MultiNumeric]
      .includes(node.questionType as FormQuestionTypesEnum);
    const answer: AnswerValue = numeric
      ? (value.trim() === '' ? '' : Number.isFinite(Number(value)) ? Number(value) : '')
      : value;
    this.updateDraft(questionId, answer, []);
  }
  updateSingleChoice(questionId: string, optionId: string): void {
    this.updateDraft(questionId, optionId || null, optionId ? [optionId] : []);
  }
  toggleMultiChoice(questionId: string, optionId: string, checked: boolean): void {
    const node = this.editorRows().find((row) => row.node.questionId === questionId)?.node;
    if (!node) return;
    const selected = new Set(node.selectedOptionIds);
    if (checked) selected.add(optionId); else selected.delete(optionId);
    const ids = node.options.filter((option) => selected.has(option.id)).map((option) => option.id);
    this.updateDraft(questionId, ids.join(','), ids);
  }
  isOptionSelected(node: RetailAuditChildNode, optionId: string): boolean {
    return node.selectedOptionIds.includes(optionId);
  }
  saveEditor(): void {
    const editor = this.activeEditor();
    const draft = this.editorDraft();
    if (!editor || !draft || !this.controller || !this.editorCanSave()) return;
    const current = this.snapshot()?.selectedRetailAuditItems.find((item) =>
      item.retailAuditItemId === editor.itemId);
    if (!current) return;
    this.controller.updateRetailAuditProductAnswers(
      editor.itemId, draft as unknown as readonly unknown[], current.retaliVariables,
      validateRetailAuditChildTree(draft),
    );
    this.cancelEditor();
  }
  isContainer(node: RetailAuditChildNode): boolean {
    return node.questionType === FormQuestionTypesEnum.Group ||
      node.questionType === FormQuestionTypesEnum.Matrix ||
      node.questionType === FormQuestionTypesEnum.Matrix_Dynamic;
  }
  isChoice(node: RetailAuditChildNode): boolean { return isRetailAuditChildChoice(node); }
  isMultiChoice(node: RetailAuditChildNode): boolean { return isRetailAuditChildMultiChoice(node); }
  isLongText(node: RetailAuditChildNode): boolean { return isRetailAuditChildLongText(node); }
  isRetailAuditEditorSupported(node: RetailAuditChildNode): boolean { return isRetailAuditChildEditorSupported(node); }
  inputType(node: RetailAuditChildNode): string { return isRetailAuditChildInputType(node); }

  private updateDraft(questionId: string, answer: AnswerValue, selectedOptionIds: readonly string[]): void {
    const draft = this.editorDraft();
    if (draft) this.editorDraft.set(updateRetailAuditChildAnswer(draft, questionId, answer, selectedOptionIds));
  }
  private bindController(question: QuestionModel, instanceId: string): void {
    this.snapshotSubscription?.unsubscribe();
    this.snapshot.set(null);
    this.controllerInstanceId = instanceId;
    this.lastFieldFilter = question.effectiveFieldValueFilter();
    const registration = this.refreshCoordinator.registerQuestion(question, this.vote.formGuid ?? '');
    if (!registration || registration.mode !== 'retail-audit-autocomplete') {
      this.configurationError.set('RetailAudit configuration is incomplete (question ID, data source, or form GUID).');
      this.controller = undefined;
      this.controllerVersion.update((value) => value + 1);
      return;
    }
    const model = question as RetailAuditQuestionModel;
    const initialRows = Array.isArray(model.answer) ? model.answer :
      Array.isArray(model.selectedList) ? model.selectedList : [];
    this.configurationError.set(null);
    this.controller = new DynamicDataRendererController(this.loader, this.refreshCoordinator, {
      instanceId, registration, initialRetailAuditAnswers: initialRows,
      allowDuplicateRetailAuditItems: question.settings?.['canSelectDuplicateItems'] === true,
      retailAuditRequired: question.isRequired === true,
      mandatoryCompletionAllRecords: question.settings?.['mandatoryCompletionAllRecords'] === true,
      initialFieldValueFilter: this.lastFieldFilter,
    }, (answer) => this.acceptAnswer(question, answer as readonly RetailAuditItemState[]));
    this.snapshotSubscription = this.controller.snapshot$.subscribe((state) => {
      this.snapshot.set(state);
      question.invalid.set(state.retailAuditValidation.isValid === false);
      this.syncLegacyFormulaState(question, state);
    });
    this.controller.initialize();
    this.controllerVersion.update((value) => value + 1);
  }
  private acceptAnswer(question: QuestionModel, answer: readonly RetailAuditItemState[]): void {
    const model = question as RetailAuditQuestionModel;
    const frozen = Object.freeze(answer.map((item) => Object.freeze({
      ...item, questionChilds: Object.freeze([...item.questionChilds]),
      retaliVariables: Object.freeze({ ...item.retaliVariables }),
    })));
    model.answer = frozen;
    model.selectedList = frozen;
    this.publishRuntimeAnswerChange({
      kind: 'question-value', questionRef: question.uniqueIdPerForm ?? question.uniqueId ?? '',
      value: JSON.parse(JSON.stringify(frozen)) as AnswerValue,
    });
    question.invalid.set(this.snapshot()?.retailAuditValidation.isValid === false);
  }
  private syncLegacyFormulaState(question: QuestionModel, state: DynamicDataRendererSnapshot): void {
    const key = '@Q' + question.fid;
    const formQuestion = this.vote.form[key] ?? (this.vote.form[key] = {});
    formQuestion.answer = state.selectedRetailAuditItems.map((item) => item.identificationCode);
    formQuestion.AnswerTitle = state.selectedRetailAuditItems.map((item) => item.answerTitle ?? '');
    formQuestion.Data ??= {};
    for (const field of question.dynamicDataFields ?? []) {
      const name = field.nameSpace;
      if (!name) continue;
      formQuestion.Data[name] = state.selectedRetailAuditItems.map((item) =>
        item.jsonValuesDictionary?.[name] ?? null);
    }
    formQuestion.Data.TotalAnswers = state.totalCount;
    formQuestion.selectableItemCount = state.totalCount;
  }
}
