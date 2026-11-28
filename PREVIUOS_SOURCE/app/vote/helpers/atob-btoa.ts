import { Buffer } from 'buffer';

export function DecodeString(str: string) {
  return Buffer.from(str, 'base64').toString('binary');
}

export function EncodeString(str: string) {
  return Buffer.from(str, 'binary').toString('base64');
}
