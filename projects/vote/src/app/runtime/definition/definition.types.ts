import type {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  FormGlobalVariableTypeEnum,
  FormQuestionTypesEnum,
  FormSectionTypeEnum,
} from '@service-proxies/models';

export type DefinitionDiagnosticSeverity = 'warning' | 'error';

export interface DefinitionDiagnostic {
  readonly code: string;
  readonly severity: DefinitionDiagnosticSeverity;
  readonly path: string;
  readonly message: string;
}

export interface SurveyOptionDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly uniqueIdPerForm?: string;
  readonly title?: string | null;
  readonly rowNumber?: number;
  readonly point?: number;
  readonly isExclusive?: boolean;
  readonly isDefault?: boolean;
  readonly manualCode?: string | null;
  readonly dimensionUniqueId?: string | null;
  readonly requiredDescription?: boolean;
  readonly descriptionType?: number;
  readonly descriptionPlaceholder?: string | null;
  readonly settings: Readonly<Record<string, unknown>> | null;
  readonly additionalSettings?: string | null;
}

export interface SurveyQuestionDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly uniqueIdPerForm?: string;
  readonly questionType?: FormQuestionTypesEnum;
  readonly formSectionUniqueId?: string;
  readonly parentUniqueId?: string | null;
  readonly sortKey?: number;
  readonly childSortKey?: number | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly isActive: boolean;
  readonly isRequired: boolean;
  readonly isHTML?: boolean;
  readonly settings: Readonly<Record<string, unknown>> | null;
  readonly additionalSettings?: string | null;
  readonly initialValue?: string | null;
  readonly minimumAnswer?: number | null;
  readonly maximumAnswer?: number | null;
  readonly decimalStep?: number | null;
  readonly options: readonly SurveyOptionDefinition[];
}

export interface SurveySectionDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly uniqueIdPerForm?: string;
  readonly title?: string | null;
  readonly type?: FormSectionTypeEnum;
  readonly firstQuestionSortKey?: number;
  readonly loopNumber?: number | null;
  readonly isPopUp?: boolean;
}

export interface SurveyExpressionDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly expressionText: string;
  readonly designerCode?: string | null;
  readonly targetType?: ExpressionTargetsEnum;
  readonly targetKey?: string | null;
  readonly actionType?: ExpressionActionsEnum;
  readonly formQuestionUniqueId?: string | null;
  readonly formExpressionType?: FormExpressionTypeEnum;
  readonly isActive: boolean;
  readonly isUserDefined?: boolean;
  readonly reachMaxCount?: boolean | null;
  readonly remainedPercent?: number | null;
  readonly remainedCount?: number | null;
}

export interface SurveyGlobalVariableDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly uniqueIdPerForm?: string;
  readonly title: string;
  readonly expression: string;
  readonly designerCode?: string | null;
  readonly formQuestionUniqueId?: string;
  readonly type?: FormGlobalVariableTypeEnum;
  readonly isActive: boolean;
  readonly isUserDefined?: boolean;
  readonly isSystemVariable?: boolean;
}

export interface SurveyDefinition {
  readonly id: string;
  readonly formGuid?: string;
  readonly canSubmit?: boolean;
  readonly sections: readonly SurveySectionDefinition[];
  readonly questions: readonly SurveyQuestionDefinition[];
  readonly expressions: readonly SurveyExpressionDefinition[];
  readonly globalVariables: readonly SurveyGlobalVariableDefinition[];
}

export interface SurveyDefinitionCompilation {
  readonly definition: SurveyDefinition;
  readonly diagnostics: readonly DefinitionDiagnostic[];
  readonly isValid: boolean;
}
