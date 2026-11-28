import type {
  SurveyDefinition,
  SurveyQuestionDefinition,
  SurveySectionDefinition,
} from './definition.types';

export interface SurveyDefinitionIndexes {
  /** First question in definition order for each source/form/canonical reference. */
  readonly questionByReference: ReadonlyMap<string | null | undefined, SurveyQuestionDefinition>;
  /** Action resolution matches uniqueIdPerForm, sourceId or canonical option ID. */
  readonly actionOptionIdByQuestion: WeakMap<
    SurveyQuestionDefinition,
    ReadonlyMap<string | null | undefined, string>
  >;
  /** Visibility resolution intentionally matches only uniqueIdPerForm or canonical option ID. */
  readonly visibilityOptionIdByQuestion: WeakMap<
    SurveyQuestionDefinition,
    ReadonlyMap<string | null | undefined, string>
  >;
  /** Section membership preserves definition order and all matching section aliases. */
  readonly questionsBySection: ReadonlyMap<SurveySectionDefinition, readonly SurveyQuestionDefinition[]>;
}

const definitionIndexesCache = new WeakMap<SurveyDefinition, SurveyDefinitionIndexes>();

/**
 * Builds reusable indexes for an immutable survey definition.
 *
 * Every alias map keeps the first match in source order, matching the legacy
 * Array.find behavior. Section membership is built in one pass over questions
 * while retaining duplicate section aliases across distinct sections.
 */
export function getSurveyDefinitionIndexes(definition: SurveyDefinition): SurveyDefinitionIndexes {
  const cached = definitionIndexesCache.get(definition);
  if (cached) return cached;

  const questionByReference = new Map<string | null | undefined, SurveyQuestionDefinition>();
  const actionOptionIdByQuestion = new WeakMap<
    SurveyQuestionDefinition,
    ReadonlyMap<string | null | undefined, string>
  >();
  const visibilityOptionIdByQuestion = new WeakMap<
    SurveyQuestionDefinition,
    ReadonlyMap<string | null | undefined, string>
  >();

  for (const question of definition.questions) {
    for (const reference of [question.sourceId, question.uniqueIdPerForm, question.id]) {
      if (!questionByReference.has(reference)) questionByReference.set(reference, question);
    }

    const actionOptions = new Map<string | null | undefined, string>();
    const visibilityOptions = new Map<string | null | undefined, string>();
    for (const option of question.options) {
      for (const reference of [option.uniqueIdPerForm, option.sourceId, option.id]) {
        if (!actionOptions.has(reference)) actionOptions.set(reference, option.id);
      }
      for (const reference of [option.uniqueIdPerForm, option.id]) {
        if (!visibilityOptions.has(reference)) visibilityOptions.set(reference, option.id);
      }
    }
    actionOptionIdByQuestion.set(question, actionOptions);
    visibilityOptionIdByQuestion.set(question, visibilityOptions);
  }

  const sectionsByReference = new Map<string | null | undefined, SurveySectionDefinition[]>();
  const questionsBySection = new Map<SurveySectionDefinition, SurveyQuestionDefinition[]>();
  for (const section of definition.sections) {
    questionsBySection.set(section, []);
    const aliases = new Set<string | null | undefined>([
      section.uniqueIdPerForm, section.sourceId, section.id,
    ]);
    for (const alias of aliases) {
      const matches = sectionsByReference.get(alias) ?? [];
      matches.push(section);
      sectionsByReference.set(alias, matches);
    }
  }

  for (const question of definition.questions) {
    const matchingSections = sectionsByReference.get(question.formSectionUniqueId) ?? [];
    for (const section of matchingSections) {
      questionsBySection.get(section)!.push(question);
    }
  }

  const indexes: SurveyDefinitionIndexes = Object.freeze({
    questionByReference,
    actionOptionIdByQuestion,
    visibilityOptionIdByQuestion,
    questionsBySection,
  });
  definitionIndexesCache.set(definition, indexes);
  return indexes;
}
