import { FormGlobalVariableTypeEnum } from '@service-proxies/models';
import type { SurveyGlobalVariableDefinition } from '../definition/definition.types';

export interface LegacyGlobalVariableTextOptions {
  readonly fileServerUrl?: string;
  readonly profilePictureUrl?: string;
  readonly tenantId?: string | number;
}

/**
 * Reproduces the archived getVariableResult + token replacement behavior for
 * question titles/descriptions. null means there is no known token in the source
 * and tells the caller to clear any stale runtime override.
 */
export function resolveLegacyGlobalVariableText(
  source: string | null | undefined,
  variables: readonly SurveyGlobalVariableDefinition[],
  valuesById: Readonly<Record<string, unknown>>,
  options: LegacyGlobalVariableTextOptions = {},
): string | null {
  if (typeof source !== 'string' || !source.includes('[%')) return null;
  let result = source;
  for (const variable of variables) {
    if (!variable.isActive || !variable.title) continue;
    const token = '[%' + variable.title + '%]';
    if (!result.includes(token)) continue;
    result = result.split(token).join(formatLegacyGlobalVariableDisplayValue(
      variable.type, valuesById[variable.id], options,
    ));
  }
  return result;
}

/** Keeps the archived HTML output contract for image, file and ordinary values. */
export function formatLegacyGlobalVariableDisplayValue(
  type: FormGlobalVariableTypeEnum | undefined,
  rawValue: unknown,
  options: LegacyGlobalVariableTextOptions = {},
): string {
  const value = typeof rawValue === 'string' ? rawValue.replace(/undefined/g, '') : rawValue;
  const empty = value === null || value === undefined || value === '';
  const text = empty ? '' : String(value);
  const noImage = 'assets/images/no-image.png';
  const avatar = 'assets/images/avatar.jpg';

  try {
    switch (type) {
      case FormGlobalVariableTypeEnum.ImageString:
        return empty ? noImage : 'data:image/png;base64,' + text;
      case FormGlobalVariableTypeEnum.ImageProfileFile:
        if (empty) return avatar;
        {
          const tenant = options.tenantId === undefined ? '' : 'TenantId=' + encodeURIComponent(String(options.tenantId)) + '&';
          const separator = options.profilePictureUrl?.includes('?') ? '&' : '?';
          return (options.profilePictureUrl ?? '') + separator + tenant +
            'ProfilePictureId=' + encodeURIComponent(text);
        }
      case FormGlobalVariableTypeEnum.ImageFile: {
        if (empty) return noImage;
        const files: unknown = JSON.parse(text);
        const first = Array.isArray(files) ? files[0] : undefined;
        return typeof first === 'string' && first.length > 0
          ? (options.fileServerUrl ?? '') + '/' + first
          : noImage;
      }
      case FormGlobalVariableTypeEnum.OtherFile:
        return empty ? '' : text;
      default:
        return '<span class="text-variable">' + text + '</span>';
    }
  } catch {
    return '';
  }
}
