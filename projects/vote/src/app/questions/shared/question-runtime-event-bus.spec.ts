import { describe, expect, it, vi } from 'vitest';
import { QuestionRuntimeEventBus } from './question-runtime-event-bus';

describe('QuestionRuntimeEventBus', () => {
  it('publishes typed renderer changes to subscribers', () => {
    const bus = new QuestionRuntimeEventBus();
    const received: unknown[] = [];
    bus.answerChanges$.subscribe((change) => received.push(change));

    bus.publishAnswerChange({
      kind: 'single-choice',
      questionRef: 'question-1',
      optionRef: 'option-2',
    });

    expect(received).toEqual([{
      kind: 'single-choice',
      questionRef: 'question-1',
      optionRef: 'option-2',
    }]);
  });

  it('publishes JSON-safe scalar answer values, including explicit clears', () => {
    const bus = new QuestionRuntimeEventBus();
    const received: unknown[] = [];
    bus.answerChanges$.subscribe((change) => received.push(change));

    bus.publishAnswerChange({ kind: 'question-value', questionRef: 'q-1', value: 42 });
    bus.publishAnswerChange({ kind: 'question-value', questionRef: 'q-1', value: '' });

    expect(received).toEqual([
      { kind: 'question-value', questionRef: 'q-1', value: 42 },
      { kind: 'question-value', questionRef: 'q-1', value: '' },
    ]);
  });

  it('isolates independent vote-view buses', () => {
    const first = new QuestionRuntimeEventBus();
    const second = new QuestionRuntimeEventBus();
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    first.answerChanges$.subscribe(onFirst);
    second.answerChanges$.subscribe(onSecond);

    first.publishAnswerChange({
      kind: 'multiple-choice',
      questionRef: 'question-1',
      optionRefs: ['option-1'],
    });

    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onSecond).not.toHaveBeenCalled();
  });

  it('completes its stream when the view is disposed', () => {
    const bus = new QuestionRuntimeEventBus();
    const complete = vi.fn();
    bus.answerChanges$.subscribe({ complete });

    bus.complete();

    expect(complete).toHaveBeenCalledOnce();
  });
});
