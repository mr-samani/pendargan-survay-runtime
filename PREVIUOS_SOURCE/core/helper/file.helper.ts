export const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'tif', 'bmp', 'heic', 'webp'];
export const VIDEO_TYPES = ['mp4', 'mpeg', 'avi', 'wmv', 'mkv', 'flv', '3gp'];

/**
 * تبدیل حجم بایت به واحد قابل فهم کاربر
 * @param size  بایت
 * @returns KB , MB, GB, TB, PB, EB, ZB YB
 */
export function humanFileSize(size: number) {
  size = +size;
  if (Number.isNaN(size)) {
    return '';
  }
  if (size < 1024) return size + ' B';
  let i = Math.floor(Math.log(size) / Math.log(1024));
  let num = size / Math.pow(1024, i);
  let round = Math.round(num);
  num = round < 10 ? +num.toFixed(2) : round < 100 ? +num.toFixed(1) : round;
  return `${num} ${'KMGTPEZY'[i - 1]}B`;
}

export function isImage(ext?: string): boolean {
  if (!ext) return false;
  const list = [...IMAGE_TYPES, ...IMAGE_TYPES.map((x) => '.' + x)];
  return list.indexOf(ext.toLowerCase()) > -1;
}

export function isVideo(ext?: string): boolean {
  if (!ext) return false;
  const list = [...VIDEO_TYPES, ...VIDEO_TYPES.map((x) => '.' + x)];
  return list.indexOf(ext.toLowerCase()) > -1;
}
