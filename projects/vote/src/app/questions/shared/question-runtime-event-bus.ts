import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import type { AnswerValue } from '../../runtime/state/answer-state.types';

export type RendererAnswerChange =
  | {
      readonly kind: 'single-choice';
      readonly questionRef: string;
      readonly optionRef: string;
    }
  | {
      readonly kind: 'multiple-choice';
      readonly questionRef: string;
      readonly optionRefs: readonly string[];
    }
  | {
      /** JSON-safe answer payload for non-option questions such as dynamic data. */
      readonly kind: 'question-value';
      readonly questionRef: string;
      readonly value: AnswerValue;
    };

/**
 * Per-vote-view event channel used by dynamically-created question renderers.
 * The service is provided by VoteComponent, not globally, so concurrent survey
 * views cannot accidentally share answer events.
 */
@Injectable()
export class QuestionRuntimeEventBus {
  private readonly answerChangesSubject = new Subject<RendererAnswerChange>();

  readonly answerChanges$ = this.answerChangesSubject.asObservable();

  publishAnswerChange(change: RendererAnswerChange): void {
    this.answerChangesSubject.next(change);
  }

  complete(): void {
    this.answerChangesSubject.complete();
  }
}
