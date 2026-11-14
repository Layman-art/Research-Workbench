/* 生成 build/icon.png (256x256) 与 build/icon.ico —— 暗夜圆角方块 + 奶油色月亮 + 金色八分音符 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 512; // 2x 超采样，最后降采样到 256
const buf = new Float32Array(SIZE * SIZE * 4);

function blend(px, py, r, g, b, a) {
  if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) return;
  const i = (py * SIZE + px) * 4;
  const inv = 1 - a;
  buf[i] = buf[i] * inv + r * a;
  buf[i + 1] = buf[i + 1] * inv + g * a;
  buf[i + 2] = buf[i + 2] * inv + b * a;
  buf[i + 3] = Math.min(255, buf[i + 3] + 255 * a);
}

function fillRoundedRect(x, y, w, h, rad, [r, g, b]) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const cx = Math.max(x + rad, Math.min(px, x + w - rad - 1));
      const cy = Math.max(y + rad, Math.min(py, y + h - rad - 1));
      const d = Math.hypot(px - cx, py - cy);
      if (d <= rad) blend(px, py, r, g, b, 1);
    }
  }
}

function fillCircle(cx, cy, rad, [r, g, b], a = 1) {
  for (let py = Math.floor(cy - rad); py <= cy + rad; py++) {
    for (let px = Math.floor(cx - rad); px <= cx + rad; px++) {
      if (Math.hypot(px - cx, py - cy) <= rad) blend(px, py, r, g, b, a);
    }
  }
}

function fillEllipse(cx, cy, rx, ry, [r, g, b]) {
  for (let py = Math.floor(cy - ry); py <= cy + ry; py++) {
    for (let px = Math.floor(cx - rx); px <= cx + rx; px++) {
      const dx = (px - cx) / rx;
      const dy = (py - cy) / ry;
      if (dx * dx + dy * dy <= 1) blend(px, py, r, g, b, 1);
    }
  }
}

function fillRect(x, y, w, h, [r, g, b]) {
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) blend(px, py, r, g, b, 1);
}

function fillTriangle(x1, y1, x2, y2, x3, y3, [r, g, b]) {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const w1 = ((x2 - px) * (y3 - py) - (x3 - px) * (y2 - py)) / area;
      const w2 = ((x3 - px) * (y1 - py) - (x1 - px) * (y3 - py)) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) blend(px, py, r, g, b, 1);
    }
  }
}

const NIGHT = [23, 21, 15];
const CREAM = [242, 237, 222];
const CRATER = [201, 189, 156];
const GOLD = [217, 164, 65];

// 背景
fillRoundedRect(0, 0, SIZE, SIZE, 116, NIGHT);
// 月亮
fillCircle(196, 186, 108, CREAM);
fillCircle(232, 152, 15, CRATER, 0.55);
fillCircle(164, 216, 11, CRATER, 0.5);
fillCircle(208, 236, 8, CRATER, 0.45);
// 金色八分音符
fillEllipse(330, 356, 34, 24, GOLD); // 符头
fillRect(354, 176, 12, 186, GOLD); // 符干
fillTriangle(366, 176, 442, 216, 366, 262, GOLD); // 符尾

// 降采样到 256
const OUT = 256;
const pngRaw = Buffer.alloc(OUT * OUT * 4 + OUT);
for (let y = 0; y < OUT; y++) {
  pngRaw[y * (OUT * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < OUT; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          sum += buf[((y * 2 + dy) * SIZE + (x * 2 + dx)) * 4 + c];
      pngRaw[y * (OUT * 4 + 1) + 1 + x * 4 + c] = Math.round(sum / 4);
    }
  }
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OUT, 0);
ihdr.writeUInt32BE(OUT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(pngRaw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

// ICO（内嵌 PNG）
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; // 256
entry[1] = 0;
entry.writeUInt16LE(1, 6);
entry.writeUInt16LE(32, 8);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);
const ico = Buffer.concat([header, entry, png]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
console.log('icon written:', png.length, 'bytes png /', ico.length, 'bytes ico');
