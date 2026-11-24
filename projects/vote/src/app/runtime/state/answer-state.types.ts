export type AnswerValue =
  | null
  | string
  | number
  | boolean
  | readonly AnswerValue[]
  | { readonly [key: string]: AnswerValue };

export interface QuestionAnswerState {
  readonly questionId: string;
  readonly value: AnswerValue;
  readonly selectedOptionIds: readonly string[];
  readonly isDirty: boolean;
  readonly updatedAtRevision: number;
}

export interface AnswerStateSnapshot {
  readonly surveyId: string;
  readonly revision: number;
  readonly instances: Readonly<
    Record<string, Readonly<Record<string, QuestionAnswerState>>>
  >;
}

export interface AnswerStateDiagnostic {
  readonly code: string;
  readonly severity: 'warning' | 'error';
  readonly path: string;
  readonly message: string;
}

export type AnswerCommand =
  | {
      readonly type: 'set-value';
      readonly instanceId: string;
      readonly questionId: string;
      readonly value: AnswerValue;
    }
  | {
      readonly type: 'set-selected-options';
      readonly instanceId: string;
      readonly questionId: string;
      readonly optionIds: readonly string[];
    }
  | {
      readonly type: 'toggle-option';
      readonly instanceId: string;
      readonly questionId: string;
      readonly optionId: string;
      readonly selected: boolean;
    }
  | {
      readonly type: 'clear';
      readonly instanceId: string;
      readonly questionId: string;
    };

export interface AnswerCommandResult {
  readonly state: AnswerStateSnapshot;
  readonly applied: boolean;
  readonly changedAnswers: readonly {
    readonly instanceId: string;
    readonly questionId: string;
  }[];
  readonly diagnostics: readonly AnswerStateDiagnostic[];
}
