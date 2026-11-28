import { Injectable, OnDestroy } from '@angular/core';
import {
  DynamicDataHttpLoader,
  type DynamicDataLoaderContext,
} from './dynamic-data-http-loader';
import type { LegacyDynamicFilterUpdate } from '../session/legacy-dynamic-filter';
import type { LegacyGlobalVariableQuestionEffects } from '../session/legacy-global-variable-effects';
import {
  createDynamicDataQuestionRegistration,
  type DynamicDataQuestionRegistrationSource,
  type DynamicDataQuestionRuntimeRegistration,
} from './dynamic-data-question-runtime';

export type DynamicDataQuestionMode = 'autocomplete' | 'sku-initial-list' | 'retail-audit-autocomplete';

export interface DynamicDataQuestionRegistration {
  readonly questionId: string;
  readonly dynamicDataUniqueId: string;
  readonly formGuid: string;
  /** SKU questions support both expression autocomplete and secondary-ID initial lists. */
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
  | { readonly status: 'inactive-instance' | 'unregistered' | 'unresolved-filter' | 'unsupported-mode'; readonly questionId: string };

/**
 * Connects evaluated legacy filters to the cancellable HTTP loader.
 *
 * A SKU question has two distinct legacy request paths: its autocomplete uses
 * fieldValueFilter, while a global-variable secondary-filter change loads an
 * initial list using recordIdArrayToGet. They must never share request payload
 * construction or a deduplication key.
 */
@Injectable({ providedIn: 'root' })
export class DynamicDataRefreshCoordinator implements OnDestroy {
  private readonly registrations = new Map<string, DynamicDataQuestionRegistration>();
  private readonly lastFilters = new Map<string, string>();

  constructor(private readonly loader: DynamicDataHttpLoader) {}

  /** Registers one supported question directly from the generated form-question DTO. */
  registerQuestion(
    question: DynamicDataQuestionRegistrationSource,
    formGuid: string,
  ): DynamicDataQuestionRuntimeRegistration | undefined {
    const registration = createDynamicDataQuestionRegistration(question, formGuid);
    if (registration) this.register(registration);
    return registration;
  }

  /** Registers DynamicAnswer, SkuCount_Dynamic and RetailAudit data sources from one form. */
  registerQuestions(
    questions: readonly DynamicDataQuestionRegistrationSource[],
    formGuid: string,
  ): readonly DynamicDataQuestionRuntimeRegistration[] {
    return Object.freeze(questions
      .map((question) => this.registerQuestion(question, formGuid))
      .filter((item): item is DynamicDataQuestionRuntimeRegistration => item !== undefined));
  }

  register(question: DynamicDataQuestionRegistration): void {
    if (!question.questionId || !question.dynamicDataUniqueId || !question.formGuid) {
      throw new Error('Dynamic-data registration requires questionId, dynamicDataUniqueId and formGuid.');
    }
    this.registrations.set(question.questionId, Object.freeze({ ...question }));
  }

  unregister(questionId: string): void {
    this.registrations.delete(questionId);
    for (const key of this.lastFilters.keys()) {
      if (isFilterKeyForQuestion(key, questionId)) this.lastFilters.delete(key);
    }
  }

  activateInstance(instanceId: string): void {
    this.loader.activateInstance(instanceId);
  }

  /** Applies a FilterDynamicAnswer expression as autocomplete text for either renderer. */
  refresh(update: DynamicDataFilterRefresh): DynamicDataRefreshResult {
    const { instanceId, questionId, filterValue } = update;
    const registration = this.getActiveRegistration(instanceId, questionId);
    if ('status' in registration) return registration;

    const key = createFilterKey(instanceId, questionId, 'expression');
    if (containsUnresolvedLegacyToken(filterValue)) {
      this.loader.cancel(instanceId, questionId);
      this.lastFilters.delete(key);
      return { status: 'unresolved-filter', questionId };
    }
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
    if (!this.loader.search(context)) return { status: 'inactive-instance', questionId };

    this.lastFilters.set(key, filterValue);
    return { status: 'requested', questionId };
  }

  /** Applies one SKU secondary-filter update as a record-ID initial-list request. */
  refreshSecondaryFilter(update: DynamicDataFilterRefresh): DynamicDataRefreshResult {
    const { instanceId, questionId, filterValue } = update;
    const registration = this.getActiveRegistration(instanceId, questionId);
    if ('status' in registration) return registration;
    if (registration.mode !== 'sku-initial-list') {
      return { status: 'unsupported-mode', questionId };
    }

    const key = createFilterKey(instanceId, questionId, 'secondary');
    if (containsUnresolvedLegacyToken(filterValue)) {
      this.loader.cancel(instanceId, questionId);
      this.lastFilters.delete(key);
      return { status: 'unresolved-filter', questionId };
    }
    if (this.lastFilters.get(key) === filterValue) {
      return { status: 'unchanged', questionId };
    }

    const accepted = this.loader.loadSkuInitialList({
      instanceId,
      questionId,
      dynamicDataUniqueId: registration.dynamicDataUniqueId,
      formGuid: registration.formGuid,
      secondaryFieldValueFilter: filterValue,
    });
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

  /** Secondary-filter effects are specifically the SKU initial-list path. */
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
    return Object.freeze(updates.map((update) => this.refreshSecondaryFilter(update)));
  }

  /** Explicit user text search; does not alter either computed-filter cache. */
  search(
    instanceId: string,
    questionId: string,
    searchText: string,
    filterValue: string,
  ): boolean {
    if (instanceId !== this.loader.activeAnswerInstanceId || containsUnresolvedLegacyToken(filterValue)) {
      return false;
    }
    const registration = this.registrations.get(questionId);
    if (!registration) return false;
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

  ngOnDestroy(): void {
    this.dispose();
  }

  private getActiveRegistration(
    instanceId: string,
    questionId: string,
  ): DynamicDataQuestionRegistration | { readonly status: 'inactive-instance' | 'unregistered'; readonly questionId: string } {
    if (instanceId !== this.loader.activeAnswerInstanceId) {
      return { status: 'inactive-instance', questionId };
    }
    const registration = this.registrations.get(questionId);
    return registration ?? { status: 'unregistered', questionId };
  }
}

function createFilterKey(
  instanceId: string,
  questionId: string,
  kind: 'expression' | 'secondary',
): string {
  return JSON.stringify([instanceId, questionId, kind]);
}

function isFilterKeyForQuestion(key: string, questionId: string): boolean {
  try {
    const parsed: unknown = JSON.parse(key);
    return Array.isArray(parsed) && parsed[1] === questionId;
  } catch {
    return false;
  }
}

function containsUnresolvedLegacyToken(value: string): boolean {
  return /\[%[^%]+%\]/.test(value);
}
