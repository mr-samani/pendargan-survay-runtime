export interface DynamicOptionAutocompleteRequest {
  readonly dynamicDataUniqueId: string;
  readonly fieldToSearchIn: '' | 'DynamicExpression';
  readonly fieldValueFilter: string;
  readonly searchText: string;
  readonly resultsNumber: 500;
  readonly formGuid: string;
  readonly recordIdArrayToGet: readonly string[] | undefined;
  readonly searchWithoutSpace: true;
  readonly secondaryFieldToSearchIn: undefined;
  readonly secondaryFieldValueFilter: undefined;
}

export interface DynamicAutocompleteRequestContext {
  readonly dynamicDataUniqueId: string;
  readonly formGuid: string;
  readonly fieldValueFilter?: string | null;
  readonly searchText?: unknown;
}

/** Builds the legacy DynamicAnswer/SkuCount_Dynamic autocomplete request. */
export function createDynamicAutocompleteRequest(
  context: DynamicAutocompleteRequestContext,
): DynamicOptionAutocompleteRequest {
  const fieldValueFilter = context.fieldValueFilter ?? '';
  return Object.freeze({
    dynamicDataUniqueId: context.dynamicDataUniqueId,
    fieldToSearchIn: fieldValueFilter.trim() ? 'DynamicExpression' : '',
    fieldValueFilter,
    searchText: typeof context.searchText === 'string' ? context.searchText : '',
    resultsNumber: 500,
    formGuid: context.formGuid,
    recordIdArrayToGet: undefined,
    searchWithoutSpace: true,
    secondaryFieldToSearchIn: undefined,
    secondaryFieldValueFilter: undefined,
  });
}

/**
 * Builds the SkuCount_Dynamic initial-list request. The legacy control sends
 * record IDs from the secondary filter rather than sending that filter as text.
 */
export function createDynamicSkuInitialListRequest(
  context: Pick<DynamicAutocompleteRequestContext, 'dynamicDataUniqueId' | 'formGuid'> & {
    readonly secondaryFieldValueFilter?: string | null;
  },
): DynamicOptionAutocompleteRequest {
  return Object.freeze({
    dynamicDataUniqueId: context.dynamicDataUniqueId,
    fieldToSearchIn: '',
    fieldValueFilter: '',
    searchText: '',
    resultsNumber: 500,
    formGuid: context.formGuid,
    recordIdArrayToGet: parseDynamicRecordIds(context.secondaryFieldValueFilter ?? ''),
    searchWithoutSpace: true,
    secondaryFieldToSearchIn: undefined,
    secondaryFieldValueFilter: undefined,
  });
}

export function parseDynamicRecordIds(value: string): readonly string[] {
  return Object.freeze(value
    .split(/،|,/)
    .map((item) => item.trim())
    .filter(Boolean));
}
