export interface DynamicDataOptionIdentity {
  readonly identificationCode: string | number;
}

export interface DynamicSkuOption extends DynamicDataOptionIdentity {
  readonly ordering?: number;
  readonly dynamicDataUniqueId?: string;
}

export interface DynamicSkuSelection extends DynamicSkuOption {
  readonly quantity?: number;
  readonly total?: number | null;
  readonly history?: readonly number[];
}

export interface DynamicSkuMergeOptions {
  readonly dynamicDataUniqueId: string;
  readonly showAdvanceButtons: boolean;
}

/**
 * Restores a DynamicAnswer selection only when the refreshed result set still
 * contains the same record. This deliberately does not match by title.
 */
export function findRestorableDynamicAnswer<T extends DynamicDataOptionIdentity>(
  previous: T | undefined,
  refreshedOptions: readonly T[],
): T | undefined {
  if (!previous || previous.identificationCode == null) return undefined;
  const previousId = normalizeRecordId(previous.identificationCode);
  return refreshedOptions.find((option) =>
    normalizeRecordId(option.identificationCode) === previousId);
}

/**
 * Reconciles the legacy SkuCount_Dynamic "append all" response:
 * - existing selected rows and user-entered totals are preserved;
 * - new records are appended once with legacy defaults;
 * - saved totals are restored by identificationCode;
 * - output is stably ordered by the server's ordering field.
 */
export function mergeDynamicSkuOptions<TOption extends DynamicSkuOption>(
  selected: readonly (TOption & DynamicSkuSelection)[],
  fetched: readonly TOption[],
  previousAnswers: readonly DynamicSkuSelection[],
  options: DynamicSkuMergeOptions,
): readonly (TOption & DynamicSkuSelection)[] {
  const result = selected.map((item) => ({ ...item }));
  const selectedIds = new Set(result.map((item) => normalizeRecordId(item.identificationCode)));

  for (const option of fetched) {
    const id = normalizeRecordId(option.identificationCode);
    if (selectedIds.has(id)) continue;
    selectedIds.add(id);
    result.push({
      ...option,
      quantity: 1,
      total: options.showAdvanceButtons ? 0 : null,
      history: [],
      dynamicDataUniqueId: options.dynamicDataUniqueId,
    } as TOption & DynamicSkuSelection);
  }

  const answerById = new Map(
    previousAnswers.map((answer) => [normalizeRecordId(answer.identificationCode), answer]),
  );
  for (let index = 0; index < result.length; index++) {
    const answer = answerById.get(normalizeRecordId(result[index].identificationCode));
    if (answer && answer.total !== undefined && answer.total !== null) {
      result[index] = { ...result[index], total: Number(answer.total) };
    }
  }

  return Object.freeze(result
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = a.item.ordering;
      const right = b.item.ordering;
      if (typeof left !== 'number' || !Number.isFinite(left)) {
        return typeof right !== 'number' || !Number.isFinite(right) ? a.index - b.index : 1;
      }
      if (typeof right !== 'number' || !Number.isFinite(right)) return -1;
      return left - right || a.index - b.index;
    })
    .map(({ item }) => Object.freeze(item)));
}

function normalizeRecordId(value: string | number): string {
  return String(value);
}
