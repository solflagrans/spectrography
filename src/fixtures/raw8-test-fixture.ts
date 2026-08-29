interface Raw8FixtureOptions {
  readonly signature?: string;
  readonly channelCount?: number;
  readonly measurementMode?: number;
}

export function createRaw8Fixture({
  signature = "AVS84",
  channelCount = 1,
  measurementMode = 0,
}: Raw8FixtureOptions = {}): ArrayBuffer {
  const wavelengths = [420.5, 480.25, 530.75, 640];
  const scope = [100, 250, 175, 90];
  const dark = [4, 5, 6, 7];
  const reference = [900, 901, 902, 903];
  const trailerSize = 32;
  const byteLength = 328 + wavelengths.length * 4 * Float32Array.BYTES_PER_ELEMENT + trailerSize;
  const data = new ArrayBuffer(byteLength);
  const view = new DataView(data);

  writeAscii(view, 0, signature, 5);
  view.setUint8(5, channelCount);
  view.setUint32(6, byteLength - 16, true);
  view.setUint8(11, measurementMode);
  writeAscii(view, 14, "2107079U2", 10);
  view.setUint16(89, 10, true);
  view.setUint16(91, 13, true);
  view.setFloat32(93, 4, true);
  view.setUint32(101, 1, true);

  let offset = 328;
  for (const values of [wavelengths, scope, dark, reference]) {
    for (const value of values) {
      view.setFloat32(offset, value, true);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
  }

  return data;
}

function writeAscii(view: DataView, offset: number, value: string, length: number): void {
  for (let index = 0; index < length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index) || 0);
  }
}
