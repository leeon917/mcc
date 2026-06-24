/**
 * Deterministic vision probe image.
 *
 * Generates a 240×240 PNG split into four solid quadrants
 * (top-left red / top-right green / bottom-left blue / bottom-right yellow)
 * with a pure-Node encoder — no native deps. A model that can truly *see*
 * the image names all four colors in order; a text-only model cannot.
 */

import zlib from 'zlib';

export const EXPECTED_COLORS = ['red', 'green', 'blue', 'yellow'] as const;

export const VISION_PROBE_PROMPT =
  'This image is split into 4 equal quadrants. Name the dominant color of each in order: ' +
  'top-left, top-right, bottom-left, bottom-right. Answer with just 4 color words.';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Build the probe PNG and return it base64-encoded (no data: prefix). */
export function makeVisionProbeBase64(): string {
  const W = 240;
  const H = 240;
  const pixel = (x: number, y: number): [number, number, number] => {
    const top = y < H / 2;
    const left = x < W / 2;
    if (top && left) return [220, 30, 30]; // red
    if (top && !left) return [30, 170, 40]; // green
    if (!top && left) return [40, 80, 220]; // blue
    return [240, 210, 30]; // yellow
  };

  const raw = Buffer.alloc(H * (1 + W * 3));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const [r, g, b] = pixel(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}

/** True if the model's reply mentions all four expected colors. */
export function passesVisionProbe(reply: string): boolean {
  const low = reply.toLowerCase();
  return EXPECTED_COLORS.every((c) => low.includes(c));
}
