import { Component, inject, Injector, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  FormQuestionTypesEnum,
  GetAllFormDetailForViewInputDto,
  type GetPollGuidByTokenOutputDto,
  EntityDtoOfGuid,
  GetVoterFormQuestionAndAnswerDetailInputDto,
  type GetVoterFullDetail,
  type FormQuestionTenantPaymentGatewayListDto,
} from '@service-proxies/models';
import { FormVotingService, VotingService } from '@service-proxies/services';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { VoteService } from '../questions/services/vote.service';
import { QuestionTitleComponent } from '../questions/_question-title/question-title.component';
import { finalize } from 'rxjs';
import { MSG } from 'ngx-kit/message';
import { QuestionRuntimeEventBus } from '../questions/shared/question-runtime-event-bus';
import { DynamicDataHttpLoader } from '../runtime/data/dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from '../runtime/data/dynamic-data-refresh-coordinator';
import type { DynamicDataQuestionRegistrationSource } from '../runtime/data/dynamic-data-question-runtime';
import type { SurveyRuntimeSessionSnapshot } from '../runtime/session/runtime-session';
import { compileSurveyDefinition } from '../runtime/definition/definition.compiler';
import { compileSurveyExpressions } from '../runtime/definition/expression.compiler';
import { buildSurveyDependencyGraph } from '../runtime/definition/dependency-graph';
import { createInitialAnswerState } from '../runtime/state/answer-state.reducer';
import { createSurveyLoopRuntime } from '../runtime/flow/loop-runtime';
import {
  ConcreteSurveyRuntimeProjector,
  createSurveyFormulaEvaluator,
} from '../runtime/session/concrete-runtime-projector';
import { createSurveyFormulaScopeFactory } from '../runtime/session/formula-scope';
import { RendererRuntimeSessionBridge } from '../runtime/session/renderer-runtime-session-bridge';
import { restoreSurveyFromBackend } from '../runtime/submission/survey-answer-restorer';
import {
  RuntimeSubmissionCoordinator,
  type RuntimeSubmissionHooks,
  type RuntimeSubmissionOutcome,
} from '../runtime/submission/runtime-submission-coordinator';
import type { SurveySubmissionMetadata } from '../runtime/submission/submission-payload-builder';
import type { SurveyDefinition } from '../runtime/definition/definition.types';
import {
  removeFileAnswer,
  type FileUploadState,
  type SurveyFileUploadCoordinator,
  type FileUploadToken,
  SurveyFileTransferHost,
  type BrowserVoiceRecorder,
  type RecordedAudioFile,
} from '../runtime/file-transfer';
import type { AnswerValue } from '../runtime/state/answer-state.types';
import { PaymentQuestionApiAdapter } from '../runtime/payment/payment-question-api-adapter';
import { PaymentQuestionRuntime, PollPaymentTransactionStatus, type PaymentGateway, type PaymentQuestionSnapshot } from '../runtime/payment/payment-question-runtime';
import { PAYMENT_SIGNALR_CONNECTOR, PAYMENT_SIGNALR_EVENT, parsePaymentSignalRStatusEvent, type PaymentSignalRConnection } from '../runtime/payment/payment-signalr-connector';
import { AppConsts } from '../../core/models/app-consts';
import type { QuestionModel } from '../questions/models/question';

@Component({
  selector: 'app-vote',
  templateUrl: './vote.component.html',
  styleUrls: ['./vote.component.scss'],
  imports: [NgComponentOutlet, CommonModule, QuestionTitleComponent],
  providers: [QuestionRuntimeEventBus, DynamicDataHttpLoader, DynamicDataRefreshCoordinator],
})
export class VoteComponent implements OnInit, OnDestroy {
  protected readonly route = inject(ActivatedRoute);
  protected readonly formService = inject(FormVotingService);
  private readonly votingService = inject(VotingService);
  private readonly paymentApi = inject(PaymentQuestionApiAdapter);
  private readonly paymentSignalRConnector = inject(PAYMENT_SIGNALR_CONNECTOR, { optional: true });
  protected readonly fileTransferHost = inject(SurveyFileTransferHost);
  private readonly submissionCoordinator = new RuntimeSubmissionCoordinator(
    (dto) => this.votingService.createOrEditVoterAndDetailsTask(dto),
  );
  protected readonly vote = inject(VoteService);
  private readonly runtimeEvents = inject(QuestionRuntimeEventBus);
  private readonly injector = inject(Injector);
  private dynamicDataRefresh?: DynamicDataRefreshCoordinator;
  private readonly runtimeBridge = new RendererRuntimeSessionBridge(
    this.runtimeEvents,
    (session) => this.onRuntimeSessionAccepted(session),
    (diagnostic) => console.warn('[Survey runtime]', diagnostic),
  );

  readonly isLoading = signal(false);
  private readonly fileTransferRevision = signal(0);
  private readonly voiceRecordingRevision = signal(0);
  private runtimeDefinition?: SurveyDefinition;
  private fileTransfers?: SurveyFileUploadCoordinator;
  private voiceRecorder?: BrowserVoiceRecorder;
  private voiceRecordToken?: FileUploadToken;
  private fileTransferUnsubscribe?: () => void;
  private readonly uploadOwners = new Map<string, { questionId: string; instanceId: string }>();
  private readonly paymentRuntimes = new Map<string, PaymentQuestionRuntime>();
  private readonly paymentTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly pendingPaymentWindows = new Map<string, Window>();
  readonly paymentSnapshots = signal<Readonly<Record<string, PaymentQuestionSnapshot>>>({});
  readonly paymentFallbackUrls = signal<Readonly<Record<string, string>>>({});
  private paymentSignalRConnection?: PaymentSignalRConnection;
  private paymentSignalRHandler?: (payload: unknown) => void | boolean | Promise<boolean>;
  private paymentSignalRConnectPromise?: Promise<void>;
  private surveyStartedAt = Date.now();
  private destroyed = false;

  constructor() {
    const data: GetPollGuidByTokenOutputDto = this.route.snapshot.data['data'];
    this.initialize(data.guid!);
  }

  ngOnInit() {}

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const timer of this.paymentTimers.values()) clearInterval(timer);
    this.paymentTimers.clear();
    for (const runtime of this.paymentRuntimes.values()) runtime.dispose();
    this.paymentRuntimes.clear();
    for (const popup of this.pendingPaymentWindows.values()) {
      try { if (!popup.closed) popup.close(); } catch { /* Best-effort popup teardown. */ }
    }
    this.pendingPaymentWindows.clear();
    if (this.paymentSignalRConnection) {
      if (this.paymentSignalRHandler) this.paymentSignalRConnection.off(PAYMENT_SIGNALR_EVENT, this.paymentSignalRHandler);
      void this.paymentSignalRConnection.stop().catch(() => undefined);
      this.paymentSignalRConnection = undefined;
    }
    this.fileTransferUnsubscribe?.();
    this.fileTransfers?.dispose();
    this.fileTransfers = undefined;
    this.voiceRecorder?.dispose();
    this.voiceRecorder = undefined;
    this.uploadOwners.clear();
    this.runtimeBridge.destroy();
    this.runtimeEvents.complete();
  }

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }

  private async startCanonicalRuntime(
    resp: Parameters<typeof compileSurveyDefinition>[0],
    savedVoter?: GetVoterFullDetail,
  ): Promise<void> {
    if (!resp.formGuid) return;
    this.surveyStartedAt = Date.now();

    const definitionCompilation = compileSurveyDefinition(resp);
    if (!definitionCompilation.isValid) {
      console.warn('[Survey runtime] Definition compilation rejected:', definitionCompilation.diagnostics);
      return;
    }

    const expressions = compileSurveyExpressions(definitionCompilation, this.vote.engine);
    if (!expressions.isValid) {
      console.warn('[Survey runtime] Expression compilation rejected:', expressions.diagnostics);
      return;
    }

    const graph = buildSurveyDependencyGraph(definitionCompilation, expressions);
    if (!graph.isValid) {
      console.warn('[Survey runtime] Dependency graph rejected:', graph.diagnostics);
      return;
    }

    const definition = definitionCompilation.definition;
    this.runtimeDefinition = definition;
    this.getDynamicDataRefresh().registerQuestions(
      definition.questions.map((question) =>
        question.source as unknown as DynamicDataQuestionRegistrationSource,
      ),
      resp.formGuid,
    );
    this.fileTransferUnsubscribe?.();
    this.fileTransfers?.dispose();
    this.fileTransfers = undefined;
    this.voiceRecordToken = resp.voiceRecordToken?.uniqueId
      ? { uniqueId: resp.voiceRecordToken.uniqueId }
      : undefined;
    this.uploadOwners.clear();
    if (this.fileTransferHost.isAvailable && resp.poll?.uniqueId && resp.poll?.formUniqueId) {
      const transferSession = await this.fileTransferHost.createSession(definition, {
        formGuid: resp.formGuid,
        pollUniqueId: resp.poll.uniqueId,
        formUniqueId: resp.poll.formUniqueId,
      });
      this.fileTransfers = transferSession.coordinator;
      this.fileTransferUnsubscribe = this.fileTransfers.subscribe((state) => this.onFileUploadState(state));
    }
    const projector = new ConcreteSurveyRuntimeProjector(graph, expressions, {
      evaluate: createSurveyFormulaEvaluator(this.vote.engine, createSurveyFormulaScopeFactory),
    });

    const restored = savedVoter
      ? restoreSurveyFromBackend(definition, savedVoter, resp.tempVoter)
      : undefined;
    if (restored && !restored.isValid) {
      console.warn('[Survey runtime] Saved answers could not be restored safely:', restored.diagnostics);
      this.runtimeDefinition = undefined;
      return;
    }

    const started = this.runtimeBridge.start(
      definition,
      {
        answerState: restored?.answerState ?? createInitialAnswerState(definition),
        loopRuntime: restored?.loopRuntime ?? createSurveyLoopRuntime(definition),
      },
      projector,
    );

    if (!started.applied) {
      console.warn('[Survey runtime] Initial session was not accepted:', started.diagnostics);
    } else if (this.vote.questions.some((question) => question.questionType === FormQuestionTypesEnum.Payment)) {
      void this.connectPaymentSignalR(resp.formGuid);
    }
  }


  /** Resolve the HTTP-backed dynamic-data service only when a real survey starts. */
  private getDynamicDataRefresh(): DynamicDataRefreshCoordinator {
    return this.dynamicDataRefresh ??= this.injector.get(DynamicDataRefreshCoordinator);
  }

  /**
   * Applies the dynamic-data side effects of an accepted canonical session.
   * The active loop namespace is switched before filter requests are issued so
   * stale requests from the previous iteration cannot win the race.
   */
  private onRuntimeSessionAccepted(session: SurveyRuntimeSessionSnapshot): void {
    const activePage = session.projection.flow.pages.find(
      (page) => page.id === session.currentPageId,
    );
    const instanceId = activePage?.answerInstanceId ?? 'root';

    const dynamicDataRefresh = this.getDynamicDataRefresh();
    dynamicDataRefresh.activateInstance(instanceId);
    this.vote.synchronizeRuntimeSession(session, this.runtimeDefinition);

    dynamicDataRefresh.applyFilterResolution(
      instanceId,
      session.projection.dynamicFilterUpdates ?? [],
    );
    dynamicDataRefresh.applyGlobalVariableEffects(
      instanceId,
      session.projection.legacyGlobalVariableEffects?.sourceEffects ?? [],
    );
  }

  /**
   * Submit the current canonical snapshot. The caller supplies platform data
   * (timer, GPS, poll route, voice upload result) because those services are
   * not owned by this runtime component. Temporary save is deliberately
   * delegated to its separate legacy endpoint adapter.
   */
  async submitRuntime(
    metadata: SurveySubmissionMetadata,
    hooks: RuntimeSubmissionHooks = {},
  ): Promise<RuntimeSubmissionOutcome> {
    if (!this.runtimeDefinition || !this.runtimeBridge.session) {
      return { status: 'rejected', reason: 'The canonical survey runtime is not active.' };
    }
    const prepareMetadata = async (value: SurveySubmissionMetadata): Promise<SurveySubmissionMetadata> => {
      const prepared = hooks.prepareMetadata ? await hooks.prepareMetadata(value) : value;
      if (!this.fileTransfers) return prepared;
      this.fileTransfers.assertReadyForSubmission();
      const voiceStates = this.fileTransfers.getVoiceStates();
      if (voiceStates.length === 0) return prepared;
      const voice = this.fileTransfers.getVoiceSubmissionReference();
      return {
        ...prepared,
        voiceRecordFileIdUnique: [{ fileUniqueId: voice.fileUniqueId, order: 0 }],
      };
    };
    return this.submissionCoordinator.submit(
      this.runtimeDefinition,
      this.runtimeBridge.session,
      metadata,
      {},
      {
        ...hooks,
        prepareMetadata,
        assertReadyForSubmission: () => {
          hooks.assertReadyForSubmission?.();
          this.fileTransfers?.assertReadyForSubmission();
          this.assertFileUploadsAreInCanonicalAnswers();
        },
      },
    );
  }


  /**
   * Durable partial save used by PaymentQuestionRuntime before transaction creation.
   * The submission builder independently verifies every earlier question, so
   * incomplete answers at/after the Payment question do not block checkout.
   */
  async submitPartialPayment(
    metadata: SurveySubmissionMetadata,
    paymentQuestionUniqueId: string,
    tenantPaymentGatewayId: string,
    hooks: RuntimeSubmissionHooks = {},
  ): Promise<void> {
    const partialPayment = {
      partialRegisterFormQuestionUniqueId: paymentQuestionUniqueId,
      tenantPaymentGatewayId,
    };
    const prepareMetadata = async (value: SurveySubmissionMetadata): Promise<SurveySubmissionMetadata> => {
      const prepared = hooks.prepareMetadata ? await hooks.prepareMetadata(value) : value;
      return {
        ...prepared,
        temporarySave: false,
        isPartial: true,
        partialPayment,
      };
    };
    const outcome = await this.submitRuntime(
      { ...metadata, temporarySave: false, isPartial: true, partialPayment },
      { ...hooks, prepareMetadata },
    );
    if (outcome.status !== 'submitted') {
      const message = outcome.status === 'rejected'
        ? outcome.reason
        : outcome.status === 'failed'
          ? (outcome.error instanceof Error ? outcome.error.message : outcome.response?.error?.message)
          : 'The payment partial save did not complete.';
      throw new Error(message || 'The payment partial save did not complete.');
    }
  }

  /** Adapts the Payment runtime's lock port to the legacy question ordering. */
  setPaymentPreviousQuestionsDisabled(paymentQuestionUniqueId: string, disabled: boolean): void {
    if (!this.vote.setPaymentQuestionLock(paymentQuestionUniqueId, disabled)) {
      console.warn('[Survey runtime] Payment lock target was not found:', paymentQuestionUniqueId);
    }
  }
  getPaymentSnapshot(question: QuestionModel): PaymentQuestionSnapshot {
    const key = this.paymentQuestionKey(question);
    const runtime = this.getPaymentRuntime(question);
    return this.paymentSnapshots()[key] ?? runtime.state;
  }

  getPaymentFallbackUrl(question: QuestionModel): string | undefined {
    return this.paymentFallbackUrls()[this.paymentQuestionKey(question)];
  }

  getPaymentGateways(question: QuestionModel): readonly FormQuestionTenantPaymentGatewayListDto[] {
    return question.formQuestionTenantPaymentGateways ?? [];
  }

  isPaymentBusy(snapshot: PaymentQuestionSnapshot): boolean {
    return snapshot.phase === 'saving-partial' || snapshot.phase === 'creating-transaction' ||
      snapshot.phase === 'checking' || snapshot.phase === 'validating';
  }

  isPaymentPreviewMode(): boolean {
    const data = this.route.snapshot.data as Record<string, unknown>;
    const query = this.route.snapshot.queryParamMap;
    return data['isPreviewMode'] === true || data['previewMode'] === true ||
      query.get('preview') === 'true' || query.get('previewMode') === 'true';
  }

  paymentStatusLabel(status: number | undefined): string {
    switch (status) {
      case PollPaymentTransactionStatus.NotPaid: return 'Not paid';
      case PollPaymentTransactionStatus.AwaitingPayment: return 'Awaiting payment';
      case PollPaymentTransactionStatus.Paid: return 'Paid';
      case PollPaymentTransactionStatus.Failed: return 'Failed';
      case PollPaymentTransactionStatus.Cancelled: return 'Cancelled';
      case PollPaymentTransactionStatus.Completed: return 'Completed';
      default: return 'Unknown';
    }
  }

  paymentTimeLabel(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    return Math.floor(safe / 60).toString().padStart(2, '0') + ':' +
      (safe % 60).toString().padStart(2, '0');
  }

  async checkoutPayment(question: QuestionModel, gateway: FormQuestionTenantPaymentGatewayListDto): Promise<void> {
    const runtime = this.getPaymentRuntime(question);
    const key = this.paymentQuestionKey(question);
    const paymentGateway: PaymentGateway = {
      tenantPaymentGatewayId: gateway.tenantPaymentGatewayId ?? '',
      name: gateway.name,
      gatewayType: gateway.gatewayType,
    };
    runtime.updateContext({
      previewMode: this.isPaymentPreviewMode(),
      hasInvalidPreviousQuestion: this.hasInvalidPreviousPaymentQuestion(question),
    });
    runtime.updateAmount(question.effectivePaymentAmount());

    // A blank tab is opened synchronously in the click handler so popup blockers
    // do not reject the gateway navigation after the awaited partial save.
    if (typeof window !== 'undefined' && !this.isPaymentPreviewMode()) {
      try {
        const popup = window.open('about:blank', '_blank');
        if (popup) {
          popup.opener = null;
          this.pendingPaymentWindows.set(key, popup);
        }
      } catch { /* The explicit fallback link is shown if the browser blocks popups. */ }
    }

    const accepted = await runtime.checkout(paymentGateway);
    if (!accepted || this.pendingPaymentWindows.has(key)) {
      const pending = this.pendingPaymentWindows.get(key);
      try { if (pending && !pending.closed) pending.close(); } catch { /* Best effort. */ }
      this.pendingPaymentWindows.delete(key);
    }
  }

  refreshPayment(question: QuestionModel): void {
    void this.getPaymentRuntime(question).refreshTransaction();
  }

  cancelPayment(question: QuestionModel): void {
    void this.getPaymentRuntime(question).cancelPayment();
  }

  private paymentQuestionKey(question: QuestionModel): string {
    const questionId = question.uniqueIdPerForm ?? question.uniqueId ?? '';
    const instanceId = this.runtimeBridge.activeAnswerInstanceId ?? 'root';
    return questionId + '::' + instanceId;
  }

  private getPaymentRuntime(question: QuestionModel): PaymentQuestionRuntime {
    const key = this.paymentQuestionKey(question);
    const existing = this.paymentRuntimes.get(key);
    if (existing) return existing;

    const questionId = question.uniqueId ?? key;
    const definitionQuestion = this.runtimeDefinition?.questions.find((item) =>
      item.uniqueIdPerForm === question.uniqueIdPerForm || item.sourceId === question.uniqueId ||
      item.id === question.uniqueIdPerForm || item.id === question.uniqueId,
    );
    const answerInstanceId = this.runtimeBridge.activeAnswerInstanceId ?? 'root';
    let runtime!: PaymentQuestionRuntime;
    runtime = new PaymentQuestionRuntime({
      reservedPollGuid: this.vote.formGuid,
      formQuestionUniqueId: questionId,
      description: question.description ?? undefined,
      amount: question.effectivePaymentAmount(),
      previewMode: this.isPaymentPreviewMode(),
      hasInvalidPreviousQuestion: this.hasInvalidPreviousPaymentQuestion(question),
      required: question.isRequired === true,
    }, {
      savePartial: async (gatewayId, paymentQuestionId) => {
        await this.submitPartialPayment(this.paymentSubmissionMetadata(), paymentQuestionId, gatewayId);
      },
      createOrGetTransaction: (input) => this.paymentApi.createOrGetTransaction(input),
      getTransactionInfo: (transactionId, reservedPollGuid) => this.paymentApi.getTransactionInfo(transactionId, reservedPollGuid),
      validatePayment: (input) => this.paymentApi.validatePayment(input),
      cancelTransaction: (transactionId, reservedPollGuid) => this.paymentApi.cancelTransaction(transactionId, reservedPollGuid),
      openPaymentUrl: (url) => {
        const popup = this.pendingPaymentWindows.get(key);
        if (popup && !popup.closed) {
          popup.location.href = url;
          this.pendingPaymentWindows.delete(key);
          this.paymentFallbackUrls.update((items) => {
            const next = { ...items }; delete next[key]; return next;
          });
        } else {
          this.paymentFallbackUrls.update((items) => ({ ...items, [key]: url }));
        }
      },
      setPreviousQuestionsDisabled: (disabled) => this.setPaymentPreviousQuestionsDisabled(questionId, disabled),
      onAnswerChange: (value, validationKey) => {
        if (!definitionQuestion) {
          console.warn('[Survey runtime] Payment question is missing from the compiled definition:', questionId);
          return;
        }
        const answerValue = value ? { answer: value, validationGuid: value, validationKey: validationKey ?? '' } : null;
        const dispatched = this.runtimeBridge.dispatchToInstance(answerInstanceId, [{
          type: 'set-value', questionId: definitionQuestion.id, value: answerValue as AnswerValue,
        }]);
        if (!dispatched.applied) console.warn('[Survey runtime] Payment answer could not be committed:', dispatched.diagnostics);
      },
    }, (snapshot) => this.onPaymentStateChanged(key, runtime, snapshot));

    this.paymentRuntimes.set(key, runtime);
    this.paymentSnapshots.update((items) => ({ ...items, [key]: runtime.state }));
    return runtime;
  }

  private onPaymentStateChanged(key: string, runtime: PaymentQuestionRuntime, snapshot: PaymentQuestionSnapshot): void {
    this.paymentSnapshots.update((items) => ({ ...items, [key]: snapshot }));
    if (snapshot.remainingSeconds > 0 && !this.paymentTimers.has(key)) {
      this.paymentTimers.set(key, setInterval(() => runtime.tick(1), 1000));
    } else if (snapshot.remainingSeconds <= 0) {
      const timer = this.paymentTimers.get(key);
      if (timer !== undefined) clearInterval(timer);
      this.paymentTimers.delete(key);
    }
    if (snapshot.phase === 'paid') {
      this.paymentFallbackUrls.update((items) => {
        const next = { ...items }; delete next[key]; return next;
      });
    }
  }

  private paymentSubmissionMetadata(): SurveySubmissionMetadata {
    return {
      formGuid: this.vote.formGuid,
      elapsedTime: Math.max(0, Math.floor((Date.now() - this.surveyStartedAt) / 1000)),
      temporarySave: false,
    };
  }

  private hasInvalidPreviousPaymentQuestion(question: QuestionModel): boolean {
    const definition = this.runtimeDefinition;
    const session = this.runtimeBridge.session;
    if (!definition || !session) return true;
    const target = definition.questions.find((item) =>
      item.uniqueIdPerForm === question.uniqueIdPerForm || item.sourceId === question.uniqueId ||
      item.id === question.uniqueIdPerForm || item.id === question.uniqueId,
    );
    if (!target) return true;
    const statuses = new Map(session.projection.validation.questions.map((item) => [item.questionId, item.status]));
    return definition.questions.some((item) => {
      if (!item.isActive || (item.sortKey ?? 0) >= (target.sortKey ?? 0)) return false;
      const status = statuses.get(item.id);
      return status === undefined || status === 'invalid' || status === 'unknown';
    });
  }

  private async connectPaymentSignalR(reservedPollGuid: string): Promise<void> {
    if (!this.paymentSignalRConnector || this.paymentSignalRConnection || this.paymentSignalRConnectPromise) return;
    const base = AppConsts.remoteBaseUrl.endsWith('/') ? AppConsts.remoteBaseUrl.slice(0, -1) : AppConsts.remoteBaseUrl;
    const url = base + '/signalr-Payment-Transaction?reservedPollGuid=' + encodeURIComponent(reservedPollGuid);
    this.paymentSignalRConnectPromise = this.paymentSignalRConnector.connect(url).then(async (connection) => {
      if (this.destroyed) { await connection.stop(); return; }
      this.paymentSignalRConnection = connection;
      this.paymentSignalRHandler = async (payload) => {
        const event = parsePaymentSignalRStatusEvent(payload);
        if (!event) return false;
        for (const paymentRuntime of this.paymentRuntimes.values()) {
          if (await paymentRuntime.acceptSignalRStatus(event)) return true;
        }
        return false;
      };
      connection.on(PAYMENT_SIGNALR_EVENT, this.paymentSignalRHandler);
    }).catch((error: unknown) => {
      console.warn('[Survey runtime] Payment SignalR is unavailable; manual status refresh remains available.', error);
    }).finally(() => { this.paymentSignalRConnectPromise = undefined; });
    await this.paymentSignalRConnectPromise;
  }


  /** Starts one file upload for the active canonical answer instance. */
  uploadFile(questionId: string, file: File): FileUploadState {
    const transfers = this.requireFileTransfers();
    const session = this.runtimeBridge.session;
    const instanceId = this.runtimeBridge.activeAnswerInstanceId;
    if (!session || !instanceId) throw new Error('The canonical survey session is not active.');
    const currentAnswer = session.answers.instances[instanceId]?.[questionId]?.value ?? null;
    const state = transfers.upload(questionId, file, currentAnswer, instanceId);
    this.uploadOwners.set(state.uploadId, { questionId, instanceId });
    return state;
  }

  /** Adds every selected file through the canonical TUS coordinator. */
  selectQuestionFiles(questionId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        this.uploadFile(questionId, file);
      } catch (error) {
        MSG.error(error instanceof Error ? error.message : 'The selected file could not be uploaded.');
      }
    }
    input.value = '';
  }

  getVoiceUploadStates(): readonly FileUploadState[] {
    this.fileTransferRevision();
    return this.fileTransfers?.getVoiceStates() ?? [];
  }

  getFileUploadStates(questionId: string): readonly FileUploadState[] {
    this.fileTransferRevision();
    return this.fileTransfers?.getQuestionStates(questionId, this.runtimeBridge.activeAnswerInstanceId) ?? [];
  }

  retryFileUpload(uploadId: string): boolean {
    return this.fileTransfers?.retry(uploadId) ?? false;
  }

  cancelFileUpload(uploadId: string): boolean {
    return this.fileTransfers?.cancel(uploadId) ?? false;
  }

  /** Removes both the transport entry and its canonical answer value, if already committed. */
  removeFileUpload(uploadId: string): boolean {
    const transfers = this.fileTransfers;
    if (!transfers) return false;
    const state = transfers.getState(uploadId);
    const owner = this.uploadOwners.get(uploadId);
    if (!state || !owner || ['uploading', 'retrying'].includes(state.status)) return false;

    if (state.result?.fileUniqueId && owner.questionId !== '__voice__') {
      const session = this.runtimeBridge.session;
      const current = session?.answers.instances[owner.instanceId]?.[owner.questionId]?.value ?? null;
      const value = removeFileAnswer(current, state.result.fileUniqueId) as unknown as AnswerValue;
      const dispatched = this.runtimeBridge.dispatchToInstance(owner.instanceId, [
        { type: 'set-value', questionId: owner.questionId, value },
      ]);
      if (!dispatched.applied) return false;
    }
    const removed = transfers.remove(uploadId);
    if (removed) this.uploadOwners.delete(uploadId);
    return removed;
  }

  async startVoiceRecording(): Promise<boolean> {
    if (!this.fileTransfers) throw new Error('The TUS file-transfer host is not configured.');
    if (!this.voiceRecorder) this.voiceRecorder = this.fileTransferHost.createBrowserVoiceRecorder();
    const started = await this.voiceRecorder.start();
    this.voiceRecordingRevision.update((revision) => revision + 1);
    return started;
  }

  getVoiceRecordingState() {
    this.voiceRecordingRevision();
    return this.voiceRecorder?.getState() ?? { status: 'idle' as const, durationMs: 0 };
  }

  async stopVoiceRecording(): Promise<FileUploadState> {
    if (!this.voiceRecorder || !this.fileTransfers) throw new Error('No active voice recorder is configured.');
    const recording: RecordedAudioFile = await this.voiceRecorder.stop();
    this.voiceRecordingRevision.update((revision) => revision + 1);
    const state = this.fileTransfers.uploadVoice(recording, this.voiceRecordToken);
    this.uploadOwners.set(state.uploadId, {
      questionId: '__voice__',
      instanceId: this.runtimeBridge.activeAnswerInstanceId ?? 'root',
    });
    return state;
  }

  cancelVoiceRecording(): boolean {
    const cancelled = this.voiceRecorder?.cancel() ?? false;
    this.voiceRecordingRevision.update((revision) => revision + 1);
    return cancelled;
  }

  private onFileUploadState(state: FileUploadState): void {
    this.fileTransferRevision.update((revision) => revision + 1);
    if (state.status !== 'succeeded') return;
    const owner = this.uploadOwners.get(state.uploadId);
    if (!owner || owner.questionId === '__voice__') return;
    const session = this.runtimeBridge.session;
    if (!session) return;
    const current = session.answers.instances[owner.instanceId]?.[owner.questionId]?.value ?? null;
    const value = this.fileTransfers!.buildAnswer(owner.questionId, current, owner.instanceId) as unknown as AnswerValue;
    const result = this.runtimeBridge.dispatchToInstance(owner.instanceId, [{ type: 'set-value', questionId: owner.questionId, value }]);
    if (!result.applied) {
      console.warn('[Survey runtime] Uploaded file could not be committed to the canonical answer:', result.diagnostics);
    }
  }

  private assertFileUploadsAreInCanonicalAnswers(): void {
    const transfers = this.fileTransfers;
    const session = this.runtimeBridge.session;
    if (!transfers || !session) return;
    for (const [uploadId, owner] of this.uploadOwners) {
      if (owner.questionId === '__voice__') continue;
      const state = transfers.getState(uploadId);
      if (state?.status !== 'succeeded' || !state.result?.fileUniqueId) continue;
      const answer = session.answers.instances[owner.instanceId]?.[owner.questionId]?.value;
      const exists = Array.isArray(answer) && answer.some((item) =>
        !!item && typeof item === 'object' && !Array.isArray(item) &&
        (item as Readonly<Record<string, unknown>>)['fileUniqueId'] === state.result!.fileUniqueId,
      );
      if (!exists) {
        throw new Error('A completed upload is not present in the canonical answer state. Remove it or restore the matching answer before submitting.');
      }
    }
  }

  private requireFileTransfers(): SurveyFileUploadCoordinator {
    if (!this.fileTransfers) {
      throw new Error('The TUS file-transfer host is not configured. Provide TUS_UPLOAD_CONSTRUCTOR and a valid remoteBaseUrl.');
    }
    return this.fileTransfers;
  }

  private restoreRequestedEditVoter(
    resp: Parameters<typeof compileSurveyDefinition>[0],
    pollGuid: string,
  ): Promise<GetVoterFullDetail | undefined> {
    const query = this.route.snapshot.queryParams ?? {};
    const params = this.route.snapshot.params ?? {};
    const voterSequentialUniqueId = query['voterSequentialUniqueId'] ?? query['voterId'] ??
      params['voterSequentialUniqueId'] ?? params['voterId'];
    const pollUniqueId = query['pollUniqueId'] ?? params['pollUniqueId'];
    if (voterSequentialUniqueId && pollUniqueId) {
      return new Promise((resolve, reject) => {
        this.votingService.getVoterFormQuestionAndAnswerDetail(
          new GetVoterFormQuestionAndAnswerDetailInputDto({
            pollUniqueId,
            voterSequentialUniqueId,
          }),
        ).subscribe({ next: resolve, error: reject });
      });
    }

    // Match the archived temporary-save contract: the server only returns the
    // full answer payload after the participant explicitly accepts restoration.
    if (!resp.tempVoter || typeof window === 'undefined' ||
      !window.confirm('A temporary saved response is available. Do you want to restore it?')) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
      this.votingService.getVoterForEdit(new EntityDtoOfGuid({ id: pollGuid }))
        .subscribe({ next: resolve, error: reject });
    });
  }

  initialize(guid: string): void {
    this.isLoading.set(true);
    // tslint:disable-next-line: no-console
    console.time('call poll api');
    this.formService
      .getAllFormDetailForView(
        new GetAllFormDetailForViewInputDto({
          guidValue: guid,
        }),
      )
      .pipe(finalize(() => console.timeEnd('call poll api')))
      .subscribe({
        next: async (resp) => {
          this.vote
            .handleFormDetailsData(resp)
            .then(() => this.restoreRequestedEditVoter(resp, guid))
            .then(async (savedVoter) => {
              await this.startCanonicalRuntime(resp, savedVoter);
              this.isLoading.set(false);
            })
            .catch((err) => {
              this.isLoading.set(false);
              MSG.error(err?.message).afterClose.subscribe(() => {
                console.warn('Close Window!');
              });
            });
        },
        error: (er: any) => {
          this.isLoading.set(false);
          // this.handleApiError(er, true);
        },
      });
  }
}
