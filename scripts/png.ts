/**
 * Kleiner PNG-Leser und -Schreiber ohne Abhaengigkeiten.
 *
 * Gebraucht wird er, um die grossen Vorlagen aus public/assets/textures auf
 * die Kantenlaenge zu bringen, mit der der Renderer arbeitet. Node bringt
 * zlib mit, alles Weitere sind ein paar Zeilen Bitrechnerei.
 *
 * Unterstuetzt werden 8 Bit je Kanal, Farbtyp 2 (RGB) und 6 (RGBA), ohne
 * Interlace. Alles andere bricht mit einer Meldung ab, statt still etwas
 * Falsches zu liefern.
 */
import { deflateSync, inflateSync } from 'node:zlib';

export type Bitmap = { width: number; height: number; rgba: Uint8Array };

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Paeth-Praediktor aus der PNG-Spezifikation. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(file: Uint8Array): Bitmap {
  for (const [index, value] of SIGNATURE.entries()) {
    if (file[index] !== value) throw new Error('keine PNG-Datei');
  }

  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const parts: Uint8Array[] = [];

  while (offset < file.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...file.subarray(offset + 4, offset + 8));
    const body = file.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (file[offset + 16] !== 8) throw new Error('nur 8 Bit je Kanal');
      colorType = file[offset + 17] ?? 6;
      if (colorType !== 2 && colorType !== 6) throw new Error(`Farbtyp ${colorType} nicht lesbar`);
      if (file[offset + 20] !== 0) throw new Error('Interlace nicht lesbar');
    } else if (type === 'IDAT') {
      parts.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const packed = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    packed.set(part, cursor);
    cursor += part.length;
  }

  const raw = new Uint8Array(inflateSync(packed));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const previous = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const source = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const value = source[x] ?? 0;
      const left = x >= channels ? (line[x - channels] ?? 0) : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? (previous[x - channels] ?? 0) : 0;
      const restored =
        filter === 0
          ? value
          : filter === 1
            ? value + left
            : filter === 2
              ? value + up
              : filter === 3
                ? value + ((left + up) >> 1)
                : value + paeth(left, up, upLeft);
      line[x] = restored & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      rgba[to] = line[from] ?? 0;
      rgba[to + 1] = line[from + 1] ?? 0;
      rgba[to + 2] = line[from + 2] ?? 0;
      rgba[to + 3] = channels === 4 ? (line[from + 3] ?? 255) : 255;
    }
    previous.set(line);
  }

  return { width, height, rgba };
}

/**
 * Verkleinert auf `size` mal `size`, indem jeder Zielpixel den Mittelwert
 * seines Quellblocks bekommt. Nearest neighbour wuerde bei diesem
 * Verkleinerungsfaktor flimmern.
 */
export function resize(image: Bitmap, size: number): Bitmap {
  const rgba = new Uint8Array(size * size * 4);
  const scaleX = image.width / size;
  const scaleY = image.height / size;

  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * scaleY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1 && sy < image.height; sy++) {
        for (let sx = x0; sx < x1 && sx < image.width; sx++) {
          const at = (sy * image.width + sx) * 4;
          r += image.rgba[at] ?? 0;
          g += image.rgba[at + 1] ?? 0;
          b += image.rgba[at + 2] ?? 0;
          a += image.rgba[at + 3] ?? 255;
          count += 1;
        }
      }
      const to = (y * size + x) * 4;
      rgba[to] = Math.round(r / count);
      rgba[to + 1] = Math.round(g / count);
      rgba[to + 2] = Math.round(b / count);
      rgba[to + 3] = Math.round(a / count);
    }
  }
  return { width: size, height: size, rgba };
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let index = 0; index < 4; index++) out[4 + index] = type.charCodeAt(index);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

export function encodePng(image: Bitmap): Uint8Array {
  const stride = image.width * 4;
  const raw = new Uint8Array((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    raw[y * (stride + 1)] = 0; // Filtertyp "none", die Datei wird ohnehin gepackt
    raw.set(image.rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  header[8] = 8;
  header[9] = 6;

  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
