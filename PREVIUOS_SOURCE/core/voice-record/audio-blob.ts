export function exportAudioBlob(audioBuffer: AudioBuffer, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + audioBuffer.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, audioBuffer.length * 2, true);

  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < audioBuffer.length; i++) {
    view.setInt16(44 + i * 2, channelData[i] < 0 ? channelData[i] * 0x8000 : channelData[i] * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/ogg' });
}

export function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/*------------------------------*/

export function convertBlobToBase64(audioBlob: Blob): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
    reader.onerror = (ev) => {
      reject(ev);
    };
  });
}
