import { describe, expect, it } from 'vitest';
import { FormGlobalVariableTypeEnum } from '@service-proxies/models';
import type { SurveyGlobalVariableDefinition } from '../definition/definition.types';
import { formatLegacyGlobalVariableDisplayValue, resolveLegacyGlobalVariableText } from './legacy-global-variable-text';

function variable(id: string, title: string, type: FormGlobalVariableTypeEnum, isActive = true): SurveyGlobalVariableDefinition {
  return { id, title, type, isActive, expression: '', source: {} };
}

describe('legacy global-variable text projection', () => {
  it('replaces every matching title token in source order and wraps scalar values like legacy', () => {
    const variables = [
      variable('score', 'score', FormGlobalVariableTypeEnum.Decimal),
      variable('region', 'region', FormGlobalVariableTypeEnum.String),
    ];
    expect(resolveLegacyGlobalVariableText(
      'Score [%score%] / [%region%] / [%score%]', variables,
      { score: 12.5, region: 'West' },
    )).toBe('Score <span class="text-variable">12.5</span> / <span class="text-variable">West</span> / <span class="text-variable">12.5</span>');
  });

  it('preserves unresolved and inactive tokens and clears stale overrides for text without tokens', () => {
    expect(resolveLegacyGlobalVariableText('Unknown [%missing%]', [], {})).toBe('Unknown [%missing%]');
    expect(resolveLegacyGlobalVariableText('Disabled [%value%]', [
      variable('value', 'value', FormGlobalVariableTypeEnum.String, false),
    ], { value: 'ignored' })).toBe('Disabled [%value%]');
    expect(resolveLegacyGlobalVariableText('Static title', [], {})).toBeNull();
  });

  it('preserves legacy image and file output forms', () => {
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageString, 'abc'))
      .toBe('data:image/png;base64,abc');
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageString, ''))
      .toBe('assets/images/no-image.png');
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageFile, '["file-guid"]', {
      fileServerUrl: 'https://files.example.test',
    })).toBe('https://files.example.test/file-guid');
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageFile, '[]'))
      .toBe('assets/images/no-image.png');
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.OtherFile, 'https://files.test/a.pdf'))
      .toBe('https://files.test/a.pdf');
  });

  it('uses tenant-aware profile-picture links and fails closed for malformed file JSON', () => {
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageProfileFile, 'profile-id', {
      profilePictureUrl: 'https://api.example.test/profile',
      tenantId: 42,
    })).toBe('https://api.example.test/profile?TenantId=42&ProfilePictureId=profile-id');
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageProfileFile, null))
      .toBe('assets/images/avatar.jpg');
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.ImageFile, '{bad json'))
      .toBe('');
  });

  it('matches the legacy cleanup of undefined substrings before rendering', () => {
    expect(formatLegacyGlobalVariableDisplayValue(FormGlobalVariableTypeEnum.String, 'undefined-123'))
      .toBe('<span class="text-variable">-123</span>');
  });
});
