import { Component, Injector, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import type { QuestionModel } from '../models/question';
import { DynamicDataHttpLoader, type DynamicDataOption } from '../../runtime/data/dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from '../../runtime/data/dynamic-data-refresh-coordinator';
import { DynamicDataRendererController, type DynamicDataRendererSnapshot } from '../../runtime/data/dynamic-data-renderer-controller';
import type { DynamicSkuItemState } from '../../runtime/data/dynamic-data-question-runtime';
import type { AnswerValue } from '../../runtime/state/answer-state.types';

type DynamicSkuQuestionModel = QuestionModel & {
  answer?: readonly DynamicSkuItemState[] | null;
  selectedList?: readonly DynamicSkuItemState[];
};

@Component({
  selector: 'question-sku-count-dynamic',
  imports: [QuestionSharedModule],
  templateUrl: './SkuCountDynamic.html',
  styleUrl: './SkuCountDynamic.scss',
})
export class SkuCountDynamic extends QuestionBase implements OnInit, OnDestroy {
  private readonly loader = inject(DynamicDataHttpLoader);
  private readonly refreshCoordinator = inject(DynamicDataRefreshCoordinator);
  private readonly injector = inject(Injector);
  private controller?: DynamicDataRendererController;
  private snapshotSubscription?: Subscription;
  private controllerInstanceId?: string;
  private lastFieldFilter = '';
  private lastSecondaryFilter = '';
  private readonly controllerVersion = signal(0);

  readonly snapshot = signal<DynamicDataRendererSnapshot | null>(null);
  readonly searchText = signal('');
  readonly configurationError = signal<string | null>(null);
  readonly showAdvanceButtons = signal(false);

  private readonly filterEffect = effect(() => {
    const question = this.question();
    const instanceId = this.vote.activeRuntimeAnswerInstanceId();
    const fieldFilter = question.effectiveFieldValueFilter();
    const secondaryFilter = question.effectiveSecondaryFieldValueFilter();
    question.runtimeEffectRevision();
    this.controllerVersion();

    if (!this.controller) return;
    if (instanceId !== this.controllerInstanceId) {
      this.bindController(question, instanceId);
      return;
    }
    if (fieldFilter !== this.lastFieldFilter) {
      this.lastFieldFilter = fieldFilter;
      this.controller.refreshFilter(fieldFilter);
    }
    if (secondaryFilter !== this.lastSecondaryFilter && question.dontShowAllWithoutSearch === true) {
      this.lastSecondaryFilter = secondaryFilter;
      this.controller.refreshSecondaryFilter(secondaryFilter);
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
    this.searchText.set(value);
    this.controller?.search(value, this.question().effectiveFieldValueFilter());
  }

  isAdded(identificationCode: string | number): boolean {
    return this.snapshot()?.selectedSkus.some((item) => String(item.identificationCode) === String(identificationCode)) ?? false;
  }

  add(option: DynamicDataOption): void {
    this.controller?.addSku(option);
  }

  remove(id: string | number): void {
    this.controller?.removeSku(id);
  }

  increment(id: string | number): void {
    this.controller?.incrementSku(id);
  }

  decrement(id: string | number): void {
    this.controller?.decrementSku(id);
  }

  setTotal(id: string | number, value: string): void {
    if (value.trim() === '') {
      this.controller?.setSkuTotal(id, null);
      return;
    }
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isFinite(parsed)) this.controller?.setSkuTotal(id, parsed);
  }

  private bindController(question: QuestionModel, instanceId: string): void {
    this.snapshotSubscription?.unsubscribe();
    this.snapshot.set(null);
    this.controllerInstanceId = instanceId;
    this.lastFieldFilter = question.effectiveFieldValueFilter();
    this.lastSecondaryFilter = question.effectiveSecondaryFieldValueFilter();

    const registration = this.refreshCoordinator.registerQuestion(question, this.vote.formGuid ?? '');
    if (!registration || registration.mode !== 'sku-initial-list') {
      this.configurationError.set('SKU configuration is incomplete (question ID, data source, or form GUID).');
      this.controller = undefined;
      this.controllerVersion.update((value) => value + 1);
      return;
    }

    const model = question as DynamicSkuQuestionModel;
    const initialRows = Array.isArray(model.answer)
      ? model.answer
      : Array.isArray(model.selectedList) ? model.selectedList : [];
    const advanceButtons = question.settings?.['skuAdvanceButtons'] === true;
    this.showAdvanceButtons.set(advanceButtons);
    this.configurationError.set(null);
    this.controller = new DynamicDataRendererController(
      this.loader,
      this.refreshCoordinator,
      {
        instanceId,
        registration: registration as import('../../runtime/data/dynamic-data-renderer-controller').DynamicDataRendererRegistration,
        initialSkuAnswers: initialRows,
        showAdvanceButtons: advanceButtons,
        initialFieldValueFilter: this.lastFieldFilter,
        initialSecondaryFieldValueFilter: question.dontShowAllWithoutSearch === true
          ? this.lastSecondaryFilter
          : '',
      },
      (answer) => this.acceptAnswer(question, answer as readonly DynamicSkuItemState[]),
    );
    this.snapshotSubscription = this.controller.snapshot$.subscribe((state) => {
      this.snapshot.set(state);
      this.syncLegacyFormulaState(question, state);
    });
    this.controller.initialize();
    this.controllerVersion.update((value) => value + 1);
  }

  private acceptAnswer(question: QuestionModel, answer: readonly DynamicSkuItemState[]): void {
    const model = question as DynamicSkuQuestionModel;
    const frozen = Object.freeze(answer.map((item) => Object.freeze({
      ...item,
      history: Object.freeze([...(item.history ?? [])]),
    })));
    model.answer = frozen;
    model.selectedList = frozen;

    const value = JSON.parse(JSON.stringify(frozen)) as AnswerValue;
    this.publishRuntimeAnswerChange({
      kind: 'question-value',
      questionRef: question.uniqueIdPerForm ?? question.uniqueId ?? '',
      value,
    });
    question.invalid.set(question.isRequired === true &&
      (frozen.length === 0 || frozen.some((item) =>
        item.total === null || item.total === undefined || item.total === ('' as unknown))));
    this.syncLegacyFormulaState(question, this.snapshot());
  }

  private syncLegacyFormulaState(question: QuestionModel, state: DynamicDataRendererSnapshot | null): void {
    const key = '@Q' + question.fid;
    const formQuestion = this.vote.form[key] ?? (this.vote.form[key] = {});
    formQuestion.answer = state?.selectedSkus ?? [];
    formQuestion.SelectedCount = state?.selectedSkus.length ?? 0;
    formQuestion.Total = state?.selectedTotal ?? 0;
  }
}
