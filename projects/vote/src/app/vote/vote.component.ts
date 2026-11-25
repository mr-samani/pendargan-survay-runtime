import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  FormQuestionTypesEnum,
  GetAllFormDetailForViewInputDto,
  type GetPollGuidByTokenOutputDto,
} from '@service-proxies/models';
import { FormVotingService } from '@service-proxies/services';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { VoteService } from '../questions/services/vote.service';
import { QuestionTitleComponent } from '../questions/_question-title/question-title.component';
import { finalize } from 'rxjs';
import { MSG } from 'ngx-kit/message';
import { QuestionRuntimeEventBus } from '../questions/shared/question-runtime-event-bus';
import { DynamicDataHttpLoader } from '../runtime/data/dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from '../runtime/data/dynamic-data-refresh-coordinator';
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
  protected readonly vote = inject(VoteService);
  private readonly runtimeEvents = inject(QuestionRuntimeEventBus);
  private readonly runtimeBridge = new RendererRuntimeSessionBridge(
    this.runtimeEvents,
    (session) => this.vote.synchronizeRuntimeSession(session),
    (diagnostic) => console.warn('[Survey runtime]', diagnostic),
  );

  readonly isLoading = signal(false);

  constructor() {
    const data: GetPollGuidByTokenOutputDto = this.route.snapshot.data['data'];
    this.initialize(data.guid!);
  }

  ngOnInit() {}

  ngOnDestroy(): void {
    this.runtimeBridge.destroy();
    this.runtimeEvents.complete();
  }

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }

  private startCanonicalRuntime(resp: Parameters<typeof compileSurveyDefinition>[0]): void {
    if (!resp.formGuid) return;

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
    const projector = new ConcreteSurveyRuntimeProjector(graph, expressions, {
      evaluate: createSurveyFormulaEvaluator(this.vote.engine, createSurveyFormulaScopeFactory),
    });
    const started = this.runtimeBridge.start(
      definition,
      {
        answerState: createInitialAnswerState(definition),
        loopRuntime: createSurveyLoopRuntime(definition),
      },
      projector,
    );

    if (!started.applied) {
      console.warn('[Survey runtime] Initial session was not accepted:', started.diagnostics);
    }
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
            .then(() => {
              this.startCanonicalRuntime(resp);
              this.isLoading.set(false);
            })
            .catch((err) => {
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
