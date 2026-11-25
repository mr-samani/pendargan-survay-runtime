import {
  DynamicDataHttpLoader,
  type DynamicDataLoaderContext,
} from './dynamic-data-http-loader';
import type { LegacyDynamicFilterUpdate } from '../session/legacy-dynamic-filter';
import type { LegacyGlobalVariableQuestionEffects } from '../session/legacy-global-variable-effects';

export type DynamicDataQuestionMode = 'autocomplete' | 'sku-initial-list';

export interface DynamicDataQuestionRegistration {
  readonly questionId: string;
  readonly dynamicDataUniqueId: string;
  readonly formGuid: string;
  readonly mode: DynamicDataQuestionMode;
  readonly initialSearchText?: string;
}

export interface DynamicDataFilterRefresh {
  readonly instanceId: string;
  readonly questionId: string;
  readonly filterValue: string;
}

export type DynamicDataRefreshResult =
  | { readonly status: 'requested'; readonly questionId: string }
  | { readonly status: 'unchanged'; readonly questionId: string }
  | { readonly status: 'inactive-instance' | 'unregistered' | 'unresolved-filter'; readonly questionId: string };

/**
 * Connects evaluated legacy dynamic-filter updates to the cancellable HTTP
 * loader. Registrations describe the exact transport mode for each question;
 * filter values are tracked per answer instance, never globally per question.
 */
export class DynamicDataRefreshCoordinator {
  private readonly registrations = new Map<string, DynamicDataQuestionRegistration>();
  private readonly lastFilters = new Map<string, string>();

  constructor(private readonly loader: DynamicDataHttpLoader) {}

  register(question: DynamicDataQuestionRegistration): void {
    if (!question.questionId || !question.dynamicDataUniqueId || !question.formGuid) {
      throw new Error('Dynamic-data registration requires questionId, dynamicDataUniqueId and formGuid.');
    }
    this.registrations.set(question.questionId, Object.freeze({ ...question }));
  }

  unregister(questionId: string): void {
    this.registrations.delete(questionId);
    for (const key of this.lastFilters.keys()) {
      if (key.endsWith(',' + JSON.stringify(questionId) + ']')) this.lastFilters.delete(key);
    }
  }

  activateInstance(instanceId: string): void {
    this.loader.activateInstance(instanceId);
  }

  /** Applies one resolved FilterDynamicAnswer/secondary-filter update. */
  refresh(update: DynamicDataFilterRefresh): DynamicDataRefreshResult {
    const { instanceId, questionId, filterValue } = update;
    if (instanceId !== this.loader.activeAnswerInstanceId) {
      return { status: 'inactive-instance', questionId };
    }

    const registration = this.registrations.get(questionId);
    if (!registration) return { status: 'unregistered', questionId };

    // A filter with unresolved legacy placeholders must never hit the server.
    if (containsUnresolvedLegacyToken(filterValue)) {
      this.loader.cancel(instanceId, questionId);
      this.lastFilters.delete(createFilterKey(instanceId, questionId));
      return { status: 'unresolved-filter', questionId };
    }

    const key = createFilterKey(instanceId, questionId);
    if (this.lastFilters.get(key) === filterValue) {
      return { status: 'unchanged', questionId };
    }

    const context: DynamicDataLoaderContext = {
      instanceId,
      questionId,
      dynamicDataUniqueId: registration.dynamicDataUniqueId,
      formGuid: registration.formGuid,
      fieldValueFilter: filterValue,
      searchText: registration.initialSearchText ?? '',
    };

    const accepted = registration.mode === 'sku-initial-list'
      ? this.loader.loadSkuInitialList({
          instanceId,
          questionId,
          dynamicDataUniqueId: registration.dynamicDataUniqueId,
          formGuid: registration.formGuid,
          secondaryFieldValueFilter: filterValue,
        })
      : this.loader.search(context);

    if (!accepted) return { status: 'inactive-instance', questionId };
    this.lastFilters.set(key, filterValue);
    return { status: 'requested', questionId };
  }

  /** Applies all FilterDynamicAnswer results produced by one projection pass. */
  applyFilterResolution(
    instanceId: string,
    updates: readonly LegacyDynamicFilterUpdate[],
  ): readonly DynamicDataRefreshResult[] {
    return Object.freeze(updates.map((update) => this.refresh({
      instanceId,
      questionId: update.questionId,
      filterValue: update.value,
    })));
  }

  /** Applies secondary-filter changes emitted by legacy global-variable effects. */
  applyGlobalVariableEffects(
    instanceId: string,
    effects: readonly LegacyGlobalVariableQuestionEffects[],
  ): readonly DynamicDataRefreshResult[] {
    const updates = effects
      .filter((effect) => effect.shouldTriggerDynamicFilter &&
        effect.secondaryFieldValueFilter !== undefined)
      .map((effect) => ({
        instanceId,
        questionId: effect.questionId,
        filterValue: effect.secondaryFieldValueFilter!,
      }));
    return Object.freeze(updates.map((update) => this.refresh(update)));
  }

  /** Explicit user text search; does not alter the evaluated filter cache. */
  search(
    instanceId: string,
    questionId: string,
    searchText: string,
    filterValue: string,
  ): boolean {
    if (instanceId !== this.loader.activeAnswerInstanceId) return false;
    const registration = this.registrations.get(questionId);
    if (!registration || containsUnresolvedLegacyToken(filterValue)) return false;
    return this.loader.search({
      instanceId,
      questionId,
      dynamicDataUniqueId: registration.dynamicDataUniqueId,
      formGuid: registration.formGuid,
      fieldValueFilter: filterValue,
      searchText,
    });
  }

  dispose(): void {
    this.registrations.clear();
    this.lastFilters.clear();
    this.loader.dispose();
  }
}

function createFilterKey(instanceId: string, questionId: string): string {
  return JSON.stringify([instanceId, questionId]);
}

function containsUnresolvedLegacyToken(value: string): boolean {
  return /\[%[^%]+%\]/.test(value);
}
