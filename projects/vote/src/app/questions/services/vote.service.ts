import { computed, inject, Service, signal } from '@angular/core';
import { QuestionModel } from '../models/question';
import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  type GetAllFormDetailForViewOutputDto,
  type GetFormExpressionDto,
  type GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';
import { FormulaEngineService } from 'ngx-exp-parser';
import type { ExpressionModel } from '../models/Expression';
import type { SurveyDefinition } from '../../runtime/definition/definition.types';
import type { SurveyRuntimeSessionSnapshot } from '../../runtime/session/runtime-session';
import { getQuestionAnswer } from '../../runtime/state/answer-state.reducer';
import { projectCanonicalAnswerToLegacy } from '../../runtime/session/legacy-answer-state-projection';
import { loadQuestionRenderers } from '../definitions';
import { Notify } from 'ngx-kit/notify';
import { MSG } from 'ngx-kit/message';
import type { LegacyGlobalVariableEffectBatch } from '../../runtime/session/legacy-global-variable-dispatcher';
import {
  getCurrentSurveyRuntimePage,
  type SurveyRuntimeSessionSnapshot,
} from '../../runtime/session/runtime-session';
import {
  applyQuestionRuntimeEffects,
  getQuestionRuntimeEffect,
  replaceQuestionRuntimeDynamicFilters,
  type QuestionRuntimeEffectApplication,
  type QuestionRuntimeEffectsByInstance,
  type QuestionRuntimeDynamicFilterUpdate,
} from '../models/question-runtime-effects';

@Service()
export class VoteService {
  readonly engine = inject(FormulaEngineService);
  formGuid = '';
  questions: QuestionModel[] = [];

  /** Runtime side effects are retained independently for every loop answer instance. */
  private readonly runtimeEffectsByInstance = signal<QuestionRuntimeEffectsByInstance>(Object.freeze({}));
  readonly activeRuntimeAnswerInstanceId = signal('root');
  // هر سوال در یک صفحه نشان داده شود
  oneQuestionPerPage = false;
  showQuestionNumberInPollingPage = false;
  // TODO
  showRequiredFormQuestionValidate = false;

  private pageQfrom = signal(0);
  private pageSize = signal(1000);

  // در حالت نمایش تک صفحه ای = در کدام صفحه هستیم
  private pageOffset = signal(0);

  form = this.engine.createReactiveModel<Record<string, any>>({});

  /** برای تبدیل سریع فرمول یونیک ایدی به فرمول قابل فهم */
  stateMap = new Map<string, string>();

  readonly questionList = computed(() => {
    if (this.oneQuestionPerPage) {
      return this.questions.slice(this.pageOffset(), this.pageOffset() + 1);
    } else {
      return this.questions.slice(this.pageQfrom(), this.pageQfrom() + this.pageSize());
    }
  });

  async handleFormDetailsData(resp: GetAllFormDetailForViewOutputDto) {
    this.formGuid = resp.formGuid ?? '';
    this.runtimeEffectsByInstance.set(Object.freeze({}));
    this.activeRuntimeAnswerInstanceId.set('root');
    this.oneQuestionPerPage = resp.poll?.showOneQuestionInAnyPage === true;
    this.showQuestionNumberInPollingPage = resp.poll?.showQuestionNumberInPollingPage === true;
    await this.iniitlizeQuestions(resp.formQuestions ?? []);
    await this.initializeExpressions(resp.formExpressions ?? []);
    this.activateRuntimeAnswerInstance('root');
  }

  /**
   * Consumes non-answer effects emitted by the runtime projector.
   * Question IDs use the same uniqueIdPerForm key as the compiled definition.
   */
  applyLegacyGlobalVariableEffects(
    instanceId: string,
    batch: LegacyGlobalVariableEffectBatch,
  ): QuestionRuntimeEffectApplication {
    const previous = this.runtimeEffectsByInstance();
    const result = applyQuestionRuntimeEffects(previous, instanceId, batch);
    if (result.state !== previous) this.runtimeEffectsByInstance.set(result.state);

    if (instanceId === this.activeRuntimeAnswerInstanceId()) {
      this.syncQuestionRuntimeEffects(instanceId, result.changedQuestionIds);
    }
    return result;
  }

  /** Replaces the complete dynamic-expression filter projection for one answer instance. */
  applyRuntimeDynamicFilterUpdates(
    instanceId: string,
    updates: readonly QuestionRuntimeDynamicFilterUpdate[],
  ): readonly string[] {
    const previous = this.runtimeEffectsByInstance();
    const result = replaceQuestionRuntimeDynamicFilters(previous, instanceId, updates);
    if (result.state !== previous) this.runtimeEffectsByInstance.set(result.state);

    if (instanceId === this.activeRuntimeAnswerInstanceId()) {
      this.syncQuestionRuntimeEffects(instanceId, result.changedQuestionIds);
    }
    return result.changedQuestionIds;
  }

  /** Activates the UI-facing effects for a root or SectionLoop answer instance. */
  activateRuntimeAnswerInstance(instanceId: string): void {
    this.activeRuntimeAnswerInstanceId.set(instanceId);
    this.syncQuestionRuntimeEffects(instanceId, this.questions.map((question) =>
      question.uniqueIdPerForm ?? question.uniqueId ?? '',
    ));
  }

  /**
   * Applies the current runtime projection to the legacy question-model UI.
   * Call after every accepted session transition (create, answer dispatch, or navigation).
   * This adapter does not mutate canonical session answer state.
   */
  synchronizeRuntimeSession(session: SurveyRuntimeSessionSnapshot, definition?: SurveyDefinition): void {
    const page = getCurrentSurveyRuntimePage(session);
    const instanceId = page?.answerInstanceId ?? 'root';

    if (definition) this.synchronizeCanonicalAnswers(session, definition, instanceId);

    if (session.projection.legacyGlobalVariableEffects) {
      this.applyLegacyGlobalVariableEffects(
        instanceId,
        session.projection.legacyGlobalVariableEffects,
      );
    }

    this.applyRuntimeDynamicFilterUpdates(
      instanceId,
      session.projection.dynamicFilterUpdates ?? [],
    );
    this.activateRuntimeAnswerInstance(instanceId);
  }

  /**
   * Rehydrates the active legacy view from canonical state after every accepted
   * renderer command or navigation. The runtime snapshot remains authoritative.
   */
  private synchronizeCanonicalAnswers(
    session: SurveyRuntimeSessionSnapshot,
    definition: SurveyDefinition,
    instanceId: string,
  ): void {
    const answers = session.answers.instances[instanceId];
    if (!answers) return;
    const legacyQuestions = new Map(this.questions.map((item) => [
      item.uniqueIdPerForm ?? item.uniqueId ?? '',
      item,
    ]));

    for (const definitionQuestion of definition.questions) {
      const legacy = legacyQuestions.get(
        definitionQuestion.uniqueIdPerForm ?? definitionQuestion.sourceId ?? definitionQuestion.id,
      );
      if (!legacy) continue;

      const projection = projectCanonicalAnswerToLegacy(
        definitionQuestion,
        getQuestionAnswer(session.answers, instanceId, definitionQuestion.id),
      );
      legacy.answer = projection.answer;
      legacy.descriptionAnswer = projection.descriptionAnswer;
      legacy.temporaryAnswerApplied = projection.hasAnswer;

      for (const projectedOption of projection.options) {
        const option = legacy.questionOptions.find((item) =>
          item.uniqueIdPerForm === projectedOption.optionId ||
          item.uniqueId === projectedOption.sourceOptionId,
        );
        if (!option) continue;
        option.selected = projectedOption.selected;
        option.answerDescription = projectedOption.answerDescription;
        option.orderAnswer = projectedOption.orderAnswer;
      }

      const questionKey = '@Q' + legacy.fid;
      this.form[questionKey] ??= { answer: null };
      this.form[questionKey].answer = projection.answer;
      for (const option of legacy.questionOptions) {
        this.form[questionKey]['A' + option.fid] = option.selected === true;
      }
    }
  }

  private syncQuestionRuntimeEffects(instanceId: string, questionIds: readonly string[]): void {
    if (questionIds.length === 0) return;
    const ids = new Set(questionIds);
    for (const question of this.questions) {
      const questionId = question.uniqueIdPerForm ?? question.uniqueId ?? '';
      if (!ids.has(questionId)) continue;
      const effect = getQuestionRuntimeEffect(this.runtimeEffectsByInstance(), instanceId, questionId);
      const paymentAmount = effect?.paymentAmount;
      const secondaryFilter = effect?.secondaryFieldValueFilter;
      const fieldFilter = effect?.fieldValueFilter;
      const hasChanged =
        !Object.is(question.runtimePaymentAmount(), paymentAmount) ||
        !Object.is(question.runtimeSecondaryFieldValueFilter(), secondaryFilter) ||
        !Object.is(question.runtimeFieldValueFilter(), fieldFilter);

      if (!hasChanged) continue;

      question.runtimePaymentAmount.set(paymentAmount);
      question.runtimeSecondaryFieldValueFilter.set(secondaryFilter);
      question.runtimeFieldValueFilter.set(fieldFilter);
      // A revision represents an effective UI change, not an instance activation.
      question.runtimeEffectRevision.update((revision) => revision + 1);
    }
  }

  private async iniitlizeQuestions(questions: GetFormQuestionQuestionOptionDto[]) {
    questions = questions.filter((x) => x.isActive).sort((a, b) => a.sortKey! - b.sortKey!);
    this.questions = [];

    let rowNumber = 0;
    for (let item of questions) {
      const q = new QuestionModel(item as QuestionModel);
      q.vote = this;
      q.rowNumber = ++rowNumber;
      this.stateMap.set('@Q' + q.fid, '#Q' + q.rowNumber);
      this.form['@Q' + q.fid] = { answer: null };

      let optRowNumber = 0;
      for (let opt of q.questionOptions) {
        this.form['@Q' + q.fid]['A' + opt.fid] = false;
        opt.rowNumber = ++optRowNumber;
        this.stateMap.set('@Q' + q.fid + '.A' + opt.fid, '#Q' + q.rowNumber + '.A' + optRowNumber);
      }
      this.questions.push(q);
    }

    // Load each distinct renderer once. Different types can download in parallel.
    const renderers = await loadQuestionRenderers(
      this.questions.map((question) => question.questionType),
    );
    for (const question of this.questions) {
      const renderer =
        question.questionType == null ? undefined : renderers.get(question.questionType);
      if (!renderer) {
        throw new Error(`Renderer was not loaded for question type: ${question.questionType}`);
      }
      question.component = renderer;
    }
  }

  private initializeExpressions(expressions: ExpressionModel[]) {
    for (let f of expressions) {
      if (!f.expressionText) continue;
      this.engine.registerFormula(f.uniqueId!, f.expressionText);
      this.humaizeExpression(f);

      const q = this.questions.find((x) => x.uniqueId == f.formQuestionUniqueId);
      if (q) {
        if (f.formExpressionType == FormExpressionTypeEnum.InsideForm) {
          switch (f.targetType) {
            case ExpressionTargetsEnum.Question:
              q.expressions[f.actionType!].push(f.expressionText);
              break;
            case ExpressionTargetsEnum.Answer:
              const opt = q.questionOptions.find((x) => x.uniqueIdPerForm == f.targetKey);
              if (opt) {
                opt.expressions[f.actionType!].push(f.expressionText);
              }

              break;
          }
        }
      }
    }
    console.log(expressions.map((m) => m.humanized));
  }

  private humaizeExpression(f: ExpressionModel) {
    const list = f.expressionText?.split(' ') ?? [];
    for (let i = 0; i < list.length; i++) {
      const r = this.stateMap.get(list[i]);
      list[i] = r ?? list[i];
    }
    f.humanized = list.join(' ');
  }
}
