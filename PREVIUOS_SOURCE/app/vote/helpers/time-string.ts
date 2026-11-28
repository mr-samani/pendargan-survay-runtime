/**
 * convert 300s to 5:00
 */
export function convertSecondstoTime(givenSeconds: number): string {
  const dateObj = new Date(givenSeconds * 1000);
  const hours = dateObj.getUTCHours();
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getSeconds();
  const timeString =
    hours.toString().padStart(2, '0') +
    ':' +
    minutes.toString().padStart(2, '0') +
    ':' +
    seconds.toString().padStart(2, '0');

  return timeString;
}
