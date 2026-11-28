import { Observable, Subject, combineLatest, map, shareReplay, startWith } from 'rxjs';
import {
  DynamicDataHttpLoader,
  type DynamicDataList,
  type DynamicDataOption,
} from './dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from './dynamic-data-refresh-coordinator';
import {
  addDynamicSku,
  decrementDynamicSku,
  incrementDynamicSku,
  reconcileDynamicAnswerOptions,
  reconcileDynamicSkuOptions,
  removeDynamicSku,
  setDynamicSkuTotal,
  sumDynamicSkuTotals,
  type DynamicDataQuestionRuntimeRegistration,
  type DynamicSkuItemState,
  addRetailAuditItem,
  removeRetailAuditItem,
  updateRetailAuditItemAnswers,
  validateRetailAuditSelection,
  type RetailAuditItemState,
} from './dynamic-data-question-runtime';
import type { DynamicDataRequestState } from './dynamic-data-request-registry';

export type DynamicDataRendererRegistration = DynamicDataQuestionRuntimeRegistration & {
  readonly mode: 'autocomplete' | 'sku-initial-list' | 'retail-audit-autocomplete';
};

export interface DynamicDataRendererOptions {
  readonly instanceId: string;
  readonly registration: DynamicDataRendererRegistration;
  readonly initialAnswer?: DynamicDataOption;
  readonly initialSkuAnswers?: readonly DynamicSkuItemState[];
  readonly initialRetailAuditAnswers?: readonly RetailAuditItemState[];
  readonly allowDuplicateRetailAuditItems?: boolean;
  readonly retailAuditRequired?: boolean;
  readonly mandatoryCompletionAllRecords?: boolean;
  readonly reservedIdentificationCodes?: readonly (string | number)[];
  readonly autoSelectFirstOption?: boolean;
  readonly checkDuplicateOptionInSectionLoop?: boolean;
  readonly showAdvanceButtons?: boolean;
  readonly initialFieldValueFilter?: string;
  readonly initialSecondaryFieldValueFilter?: string;
}

export interface DynamicDataRendererSnapshot {
  readonly status: DynamicDataRequestState<DynamicDataList>['status'];
  readonly options: readonly DynamicDataOption[];
  readonly totalCount: number;
  readonly loading: boolean;
  readonly error?: unknown;
  readonly selectedAnswer?: DynamicDataOption;
  readonly selectedSkus: readonly DynamicSkuItemState[];
  readonly selectedTotal: number;
  readonly selectedRetailAuditItems: readonly RetailAuditItemState[];
  readonly retailAuditValidation: ReturnType<typeof validateRetailAuditSelection>;
}

/**
 * Renderer-facing adapter for DynamicAnswer and SkuCount_Dynamic.
 *
 * It is deliberately independent of Angular templates and legacy QuestionModel.
 * A renderer owns this controller for one question + answer-instance pair,
 * subscribes to snapshot$, and sends answer changes through onAnswerChange.
 */
export class DynamicDataRendererController {
  private selectedAnswer?: DynamicDataOption;
  private selectedSkus: readonly DynamicSkuItemState[];
  private selectedRetailAuditItems: readonly RetailAuditItemState[];
  private retailAuditItemSequence = 0;
  private readonly localRevision = new Subject<void>();
  private readonly reservedIds: readonly (string | number)[];
  private readonly autoSelectFirstOption: boolean;
  private readonly checkDuplicates: boolean;
  private readonly showAdvanceButtons: boolean;
  private lastPublishedSkuSignature = '';
  private lastRequestKind: 'autocomplete' | 'sku-initial-list' = 'autocomplete';

  readonly snapshot$: Observable<DynamicDataRendererSnapshot>;

  constructor(
    private readonly loader: DynamicDataHttpLoader,
    private readonly refreshCoordinator: DynamicDataRefreshCoordinator,
    private readonly options: DynamicDataRendererOptions,
    private readonly onAnswerChange: (answer: DynamicDataOption | readonly DynamicSkuItemState[] | readonly RetailAuditItemState[] | undefined) => void,
  ) {
    this.selectedAnswer = options.initialAnswer;
    this.selectedSkus = Object.freeze([...(options.initialSkuAnswers ?? [])]);
    this.selectedRetailAuditItems = Object.freeze([...(options.initialRetailAuditAnswers ?? [])]);
    this.reservedIds = options.reservedIdentificationCodes ?? [];
    this.autoSelectFirstOption = options.autoSelectFirstOption === true;
    this.checkDuplicates = options.checkDuplicateOptionInSectionLoop === true;
    this.showAdvanceButtons = options.showAdvanceButtons === true;

    refreshCoordinator.register({
      ...options.registration,
    });

    this.snapshot$ = combineLatest([
      loader.watch(options.instanceId, options.registration.questionId),
      this.localRevision.pipe(startWith(undefined)),
    ]).pipe(
      map(([state]) => this.project(state)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /** Activates this loop iteration and starts the correct initial-list path. */
  initialize(): boolean {
    const { instanceId, registration } = this.options;
    this.refreshCoordinator.activateInstance(instanceId);

    if (registration.mode === 'sku-initial-list') {
      const filter = this.options.initialSecondaryFieldValueFilter ?? '';
      if (filter) {
        this.lastRequestKind = 'sku-initial-list';
        return this.refreshCoordinator.refreshSecondaryFilter({
          instanceId,
          questionId: registration.questionId,
          filterValue: filter,
        }).status === 'requested';
      }
    }

    this.lastRequestKind = 'autocomplete';
    return this.refreshCoordinator.refresh({
      instanceId,
      questionId: registration.questionId,
      filterValue: this.options.initialFieldValueFilter ?? '',
    }).status === 'requested';
  }

  /** Re-evaluated FilterDynamicAnswer output; supports both dynamic question types. */
  refreshFilter(fieldValueFilter: string): boolean {
    this.lastRequestKind = 'autocomplete';
    return this.refreshCoordinator.refresh({
      instanceId: this.options.instanceId,
      questionId: this.options.registration.questionId,
      filterValue: fieldValueFilter,
    }).status === 'requested';
  }

  /** Re-evaluated global-variable secondary filter; valid only for SKU initial lists. */
  refreshSecondaryFilter(secondaryFieldValueFilter: string): boolean {
    this.lastRequestKind = 'sku-initial-list';
    return this.refreshCoordinator.refreshSecondaryFilter({
      instanceId: this.options.instanceId,
      questionId: this.options.registration.questionId,
      filterValue: secondaryFieldValueFilter,
    }).status === 'requested';
  }

  /** User text search is separate from expression/secondary-filter refresh. */
  search(searchText: string, fieldValueFilter = this.options.initialFieldValueFilter ?? ''): boolean {
    this.lastRequestKind = 'autocomplete';
    return this.refreshCoordinator.search(
      this.options.instanceId,
      this.options.registration.questionId,
      searchText,
      fieldValueFilter,
    );
  }

  selectAnswer(option: DynamicDataOption): boolean {
    if (this.options.registration.mode !== 'autocomplete' ||
      this.loader.activeAnswerInstanceId !== this.options.instanceId) return false;
    const available = this.loader.getState(
      this.options.instanceId,
      this.options.registration.questionId,
    ).data?.options ?? [];
    const candidate = available.find((item) =>
      String(item.identificationCode) === String(option.identificationCode));
    if (!candidate) return false;

    if (this.checkDuplicates && this.reservedIds.some((id) =>
      String(id) === String(candidate.identificationCode))) return false;

    this.selectedAnswer = candidate;
    this.onAnswerChange(candidate);
    this.localRevision.next();
    return true;
  }

  clearAnswer(): void {
    if (this.options.registration.mode !== 'autocomplete' || !this.selectedAnswer ||
      this.loader.activeAnswerInstanceId !== this.options.instanceId) return;
    this.selectedAnswer = undefined;
    this.onAnswerChange(undefined);
    this.localRevision.next();
  }

  addSku(option: DynamicDataOption): boolean {
    if (this.options.registration.mode !== 'sku-initial-list' ||
      this.loader.activeAnswerInstanceId !== this.options.instanceId) return false;
    const available = this.loader.getState(
      this.options.instanceId,
      this.options.registration.questionId,
    ).data?.options ?? [];
    const candidate = available.find((item) =>
      String(item.identificationCode) === String(option.identificationCode));
    if (!candidate) return false;
    const next = addDynamicSku(
      this.selectedSkus,
      candidate as DynamicSkuItemState,
      this.options.registration.dynamicDataUniqueId,
      this.showAdvanceButtons,
    );
    return this.commitSkus(next);
  }

  removeSku(identificationCode: string | number): boolean {
    return this.commitSkus(removeDynamicSku(this.selectedSkus, identificationCode));
  }

  incrementSku(identificationCode: string | number): boolean {
    return this.commitSkus(incrementDynamicSku(this.selectedSkus, identificationCode));
  }

  decrementSku(identificationCode: string | number): boolean {
    return this.commitSkus(decrementDynamicSku(this.selectedSkus, identificationCode));
  }

  setSkuTotal(identificationCode: string | number, total: number | null): boolean {
    return this.commitSkus(setDynamicSkuTotal(this.selectedSkus, identificationCode, total));
  }

  get selectedSkuTotal(): number {
    return sumDynamicSkuTotals(this.selectedSkus);
  }

  addRetailAuditProduct(option: DynamicDataOption): boolean {
    if (this.options.registration.mode !== 'retail-audit-autocomplete' ||
        this.loader.activeAnswerInstanceId !== this.options.instanceId) return false;
    const available = this.loader.getState(
      this.options.instanceId,
      this.options.registration.questionId,
    ).data?.options ?? [];
    const candidate = available.find((item) =>
      String(item.identificationCode) === String(option.identificationCode));
    if (!candidate) return false;

    const itemId = this.options.instanceId + ':retail-audit:' + (++this.retailAuditItemSequence);
    const next = addRetailAuditItem(
      this.selectedRetailAuditItems,
      candidate,
      itemId,
      this.options.registration.dynamicDataUniqueId,
      this.options.allowDuplicateRetailAuditItems === true,
    );
    return this.commitRetailAuditItems(next);
  }

  removeRetailAuditProduct(retailAuditItemId: string): boolean {
    return this.commitRetailAuditItems(removeRetailAuditItem(this.selectedRetailAuditItems, retailAuditItemId));
  }

  updateRetailAuditProductAnswers(
    retailAuditItemId: string,
    questionChilds: readonly unknown[],
    retaliVariables: Readonly<Record<string, string>>,
    formValid: boolean | undefined,
  ): boolean {
    return this.commitRetailAuditItems(updateRetailAuditItemAnswers(
      this.selectedRetailAuditItems,
      retailAuditItemId,
      questionChilds,
      retaliVariables,
      formValid,
    ));
  }

  private commitSkus(next: readonly DynamicSkuItemState[]): boolean {
    if (this.loader.activeAnswerInstanceId !== this.options.instanceId || next === this.selectedSkus) return false;
    this.selectedSkus = next;
    this.onAnswerChange(next);
    this.localRevision.next();
    return true;
  }

  private commitRetailAuditItems(next: readonly RetailAuditItemState[]): boolean {
    if (this.loader.activeAnswerInstanceId !== this.options.instanceId || next === this.selectedRetailAuditItems) return false;
    this.selectedRetailAuditItems = next;
    this.onAnswerChange(next);
    this.localRevision.next();
    return true;
  }

  private project(state: DynamicDataRequestState<DynamicDataList>): DynamicDataRendererSnapshot {
    const fetched = state.data?.options ?? [];
    let options: readonly DynamicDataOption[] = fetched;

    if (this.options.registration.mode === 'autocomplete') {
      const reconciled = reconcileDynamicAnswerOptions(
        fetched,
        this.selectedAnswer,
        this.checkDuplicates ? this.reservedIds : [],
        this.autoSelectFirstOption,
      );
      options = reconciled.options;
      if (reconciled.selection && (
        !this.selectedAnswer ||
        String(this.selectedAnswer.identificationCode) !== String(reconciled.selection.identificationCode)
      )) {
        this.selectedAnswer = reconciled.selection;
        this.onAnswerChange(reconciled.selection);
      }
    } else if (fetched.length && this.lastRequestKind === 'sku-initial-list') {
      const reconciled = reconcileDynamicSkuOptions(
        this.selectedSkus,
        fetched,
        this.options.initialSkuAnswers ?? [],
        {
          dynamicDataUniqueId: this.options.registration.dynamicDataUniqueId,
          showAdvanceButtons: this.showAdvanceButtons,
        },
      );
      this.selectedSkus = reconciled;
      const signature = JSON.stringify(reconciled.map((item) => [
        item.identificationCode, item.quantity, item.total, item.history,
      ]));
      if (signature !== this.lastPublishedSkuSignature) {
        this.lastPublishedSkuSignature = signature;
        this.onAnswerChange(reconciled);
      }
    }

    return Object.freeze({
      status: state.status,
      options,
      totalCount: state.data?.totalCount ?? 0,
      loading: state.status === 'loading',
      error: state.error,
      selectedAnswer: this.selectedAnswer,
      selectedSkus: this.selectedSkus,
      selectedTotal: this.selectedSkuTotal,
      selectedRetailAuditItems: this.selectedRetailAuditItems,
      retailAuditValidation: validateRetailAuditSelection(
        this.selectedRetailAuditItems,
        this.options.retailAuditRequired === true,
        this.options.mandatoryCompletionAllRecords === true,
        state.data?.totalCount ?? 0,
      ),
    });
  }
}
