import { describe, expect, it } from 'vitest';
import {
  createDynamicAutocompleteRequest,
  createDynamicSkuInitialListRequest,
  parseDynamicRecordIds,
} from './dynamic-data-request';

describe('dynamic data request builders', () => {
  it('uses DynamicExpression only when the effective filter is non-empty', () => {
    const request = createDynamicAutocompleteRequest({
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form-guid',
      fieldValueFilter: '  Category eq 10  ',
      searchText: 'coffee',
    });

    expect(request).toEqual({
      dynamicDataUniqueId: 'catalog',
      fieldToSearchIn: 'DynamicExpression',
      fieldValueFilter: '  Category eq 10  ',
      searchText: 'coffee',
      resultsNumber: 500,
      formGuid: 'form-guid',
      recordIdArrayToGet: undefined,
      searchWithoutSpace: true,
      secondaryFieldToSearchIn: undefined,
      secondaryFieldValueFilter: undefined,
    });
  });

  it('keeps empty filter requests in the legacy field-search mode', () => {
    const request = createDynamicAutocompleteRequest({
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form-guid',
      fieldValueFilter: '  ',
      searchText: { answerTitle: 'not a search string' },
    });

    expect(request.fieldToSearchIn).toBe('');
    expect(request.fieldValueFilter).toBe('  ');
    expect(request.searchText).toBe('');
  });

  it('converts Arabic and English comma-separated SKU record IDs to trimmed values', () => {
    expect(parseDynamicRecordIds(' 10,20 ، 30 ,, ')).toEqual(['10', '20', '30']);
    expect(createDynamicSkuInitialListRequest({
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form-guid',
      secondaryFieldValueFilter: '10، 20,30',
    })).toMatchObject({
      fieldToSearchIn: '',
      fieldValueFilter: '',
      searchText: '',
      recordIdArrayToGet: ['10', '20', '30'],
    });
  });

  it('sends an empty record list when the SKU secondary filter is empty', () => {
    expect(createDynamicSkuInitialListRequest({
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form-guid',
    }).recordIdArrayToGet).toEqual([]);
  });
});
