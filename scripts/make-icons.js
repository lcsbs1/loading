'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'reload', 'assets', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

/* 1. Salvar SVGs */
const svgStandard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#161616"/>
  <rect x="16" y="16" width="480" height="480" rx="80" fill="none" stroke="#262626" stroke-width="4"/>
  <circle cx="180" cy="256" r="64" fill="#F5B700"/>
  <circle cx="180" cy="244" r="56" fill="#FFC933" opacity="0.4"/>
  <circle cx="332" cy="256" r="64" fill="#E04F33"/>
  <circle cx="332" cy="244" r="56" fill="#F06A52" opacity="0.4"/>
</svg>`;

const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#161616"/>
  <circle cx="196" cy="256" r="52" fill="#F5B700"/>
  <circle cx="316" cy="256" r="52" fill="#E04F33"/>
</svg>`;

fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), svgStandard, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'icon-maskable.svg'), svgMaskable, 'utf8');

/* 2. Gerador simples de PNG (IHDR, IDAT, IEND com zlib) */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPng(size, isMaskable = false) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc(height * (1 + width * 4));

  // Renderiza pixels diretamente com geometria proporcional
  const c1x = isMaskable ? width * 0.38 : width * 0.35;
  const c2x = isMaskable ? width * 0.62 : width * 0.65;
  const cy = height * 0.5;
  const rLed = isMaskable ? width * 0.10 : width * 0.125;
  const cornerR = isMaskable ? 0 : width * 0.18;

  let pos = 0;
  for (let y = 0; y < height; y++) {
    raw[pos++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Check rounded rect boundaries if not maskable
      let inChassis = true;
      if (!isMaskable) {
        let dx = 0;
        let dy = 0;
        if (x < cornerR) dx = cornerR - x;
        else if (x > width - 1 - cornerR) dx = x - (width - 1 - cornerR);
        if (y < cornerR) dy = cornerR - y;
        else if (y > height - 1 - cornerR) dy = y - (height - 1 - cornerR);
        if (dx * dx + dy * dy > cornerR * cornerR) {
          inChassis = false;
        }
      }

      if (!inChassis) {
        raw[pos++] = 0;
        raw[pos++] = 0;
        raw[pos++] = 0;
        raw[pos++] = 0; // Transparent
        continue;
      }

      // Check LED 1 (Yellow: #F5B700)
      const d1 = Math.hypot(x - c1x, y - cy);
      // Check LED 2 (Vermilion: #E04F33)
      const d2 = Math.hypot(x - c2x, y - cy);

      if (d1 <= rLed) {
        raw[pos++] = 0xF5;
        raw[pos++] = 0xB7;
        raw[pos++] = 0x00;
        raw[pos++] = 0xFF;
      } else if (d2 <= rLed) {
        raw[pos++] = 0xE0;
        raw[pos++] = 0x4F;
        raw[pos++] = 0x33;
        raw[pos++] = 0xFF;
      } else {
        // Chassis dark: #161616
        raw[pos++] = 0x16;
        raw[pos++] = 0x16;
        raw[pos++] = 0x16;
        raw[pos++] = 0xFF;
      }
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // non-interlaced

  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(path.join(OUT_DIR, 'icon-192.png'), createPng(192, false));
fs.writeFileSync(path.join(OUT_DIR, 'icon-512.png'), createPng(512, false));
fs.writeFileSync(path.join(OUT_DIR, 'icon-maskable-512.png'), createPng(512, true));
fs.writeFileSync(path.join(OUT_DIR, 'apple-touch-icon.png'), createPng(180, false));

console.log('Icons generated successfully in reload/assets/icons/');
