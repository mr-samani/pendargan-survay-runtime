import { Component, Injector, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import type { QuestionModel } from '../models/question';
import { DynamicDataHttpLoader, type DynamicDataOption } from '../../runtime/data/dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from '../../runtime/data/dynamic-data-refresh-coordinator';
import { DynamicDataRendererController, type DynamicDataRendererSnapshot } from '../../runtime/data/dynamic-data-renderer-controller';
import type { AnswerValue } from '../../runtime/state/answer-state.types';

type DynamicQuestionModel = QuestionModel & {
  answer?: DynamicDataOption | null;
  dynamicDataFields?: readonly { nameSpace?: string | null; isNumeric?: boolean }[] | null;
};

@Component({
  selector: 'question-dynamic-answer',
  imports: [QuestionSharedModule],
  templateUrl: './DynamicAnswer.html',
  styleUrl: './DynamicAnswer.scss',
})
export class DynamicAnswer extends QuestionBase implements OnInit, OnDestroy {
  private readonly loader = inject(DynamicDataHttpLoader);
  private readonly refreshCoordinator = inject(DynamicDataRefreshCoordinator);
  private readonly injector = inject(Injector);
  private controller?: DynamicDataRendererController;
  private snapshotSubscription?: Subscription;
  private controllerInstanceId?: string;
  private lastFieldFilter = '';
  private readonly controllerVersion = signal(0);

  readonly snapshot = signal<DynamicDataRendererSnapshot | null>(null);
  readonly searchText = signal('');
  readonly configurationError = signal<string | null>(null);

  private readonly filterEffect = effect(() => {
    const question = this.question();
    const instanceId = this.vote.activeRuntimeAnswerInstanceId();
    const fieldFilter = question.effectiveFieldValueFilter();
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

  isSelectedOption(identificationCode: string | number): boolean {
    const selected = this.snapshot()?.selectedAnswer?.identificationCode;
    return selected !== undefined && String(selected) === String(identificationCode);
  }

  select(option: DynamicDataOption): void {
    this.controller?.selectAnswer(option);
  }

  clear(): void {
    this.controller?.clearAnswer();
    this.searchText.set('');
  }

  private bindController(question: QuestionModel, instanceId: string): void {
    this.snapshotSubscription?.unsubscribe();
    this.snapshot.set(null);
    this.controllerInstanceId = instanceId;
    this.lastFieldFilter = question.effectiveFieldValueFilter();

    const registration = this.refreshCoordinator.registerQuestion(question, this.vote.formGuid ?? '');
    if (!registration || registration.mode !== 'autocomplete') {
      this.configurationError.set('DynamicAnswer configuration is incomplete (question ID, data source, or form GUID).');
      this.controller = undefined;
      this.controllerVersion.update((value) => value + 1);
      return;
    }

    this.configurationError.set(null);
    const model = question as DynamicQuestionModel;
    const initialAnswer = model.answer ? normalizeOption(model.answer, registration.dynamicDataUniqueId) : undefined;
    this.controller = new DynamicDataRendererController(
      this.loader,
      this.refreshCoordinator,
      {
        instanceId,
        registration,
        initialAnswer,
        autoSelectFirstOption: question.settings?.['autoSelectFirstOption'] === true,
        checkDuplicateOptionInSectionLoop: question.settings?.['checkDuplicateOptionInSectionLoop'] === true,
        initialFieldValueFilter: this.lastFieldFilter,
      },
      (answer) => this.acceptAnswer(question, answer as DynamicDataOption | undefined),
    );
    this.snapshotSubscription = this.controller.snapshot$.subscribe((state) => {
      this.snapshot.set(state);
      this.syncLegacyFormulaState(question, state);
    });
    this.controller.initialize();
    this.controllerVersion.update((value) => value + 1);
  }

  private acceptAnswer(question: QuestionModel, answer: DynamicDataOption | undefined): void {
    const model = question as DynamicQuestionModel;
    model.answer = answer ?? null;

    const dictionary = answer?.jsonValuesDictionary ?? {};
    const value: AnswerValue = answer ? {
      identificationCode: answer.identificationCode,
      id: answer.identificationCode,
      answerTitle: answer.answerTitle ?? '',
      jsonValuesDictionary: { ...dictionary },
    } : null;

    this.publishRuntimeAnswerChange({
      kind: 'question-value',
      questionRef: question.uniqueIdPerForm ?? question.uniqueId ?? '',
      value,
    });
    question.invalid.set(question.isRequired === true && !answer);
    this.syncLegacyFormulaState(question, this.snapshot());
  }

  private syncLegacyFormulaState(
    question: QuestionModel,
    state: DynamicDataRendererSnapshot | null,
  ): void {
    const key = '@Q' + question.fid;
    const formQuestion = this.vote.form[key] ?? (this.vote.form[key] = {});
    const answer = state?.selectedAnswer;
    formQuestion.answer = answer?.identificationCode ?? null;
    formQuestion.AnswerTitle = answer?.answerTitle ?? '';
    formQuestion.Data ??= {};

    for (const field of question.dynamicDataFields ?? []) {
      const name = field.nameSpace;
      if (!name) continue;
      const raw = answer?.jsonValuesDictionary?.[name];
      formQuestion.Data[name] = raw === undefined
        ? null
        : field.isNumeric === true && raw !== '' ? Number(raw) : raw;
    }
    formQuestion.Data.TotalAnswers = state?.totalCount ?? 0;
    const unavailable = state?.options.filter((option) =>
      (option as DynamicDataOption & { isSelectedInSectionLoop?: boolean }).isSelectedInSectionLoop).length ?? 0;
    formQuestion.selectableItemCount = Math.max(0, (state?.totalCount ?? 0) - unavailable);
  }
}

function normalizeOption(option: DynamicDataOption, dynamicDataUniqueId: string): DynamicDataOption {
  return {
    ...option,
    dynamicDataUniqueId: option.dynamicDataUniqueId || dynamicDataUniqueId,
    ordering: Number.isFinite(option.ordering) ? option.ordering : 0,
    identificationCode: option.identificationCode,
  };
}
