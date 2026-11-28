/**
 * Convert json keys to lowser case
 */
export function convertToLowerCaseData(data: string): string {
  const regex = new RegExp('"([A-Z])([^"]*)":', 'g');
  return data.replace(regex, (_, first, rest) => {
    return `"${first.toLowerCase()}${rest}":`;
  });
}
