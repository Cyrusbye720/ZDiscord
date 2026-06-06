#!/usr/bin/env node
/*
 * crop-banner.js
 *
 * Produces square and small-icon variants of images/banner.png so they
 * can be uploaded to plugin marketplaces that need an avatar.
 *
 * Usage:  node scripts/crop-banner.js
 * Output: images/banner-square.png  (1024x1024, centre-cropped)
 *         images/banner-icon.png    (256x256, centre-cropped)
 *
 * No external dependencies — uses only the standard library.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const INPUT = path.join(__dirname, "..", "images", "banner.png");
const OUT_SQUARE = path.join(__dirname, "..", "images", "banner-square.png");
const OUT_ICON = path.join(__dirname, "..", "images", "banner-icon.png");

if (!fs.existsSync(INPUT)) {
    console.error("Input not found: " + INPUT);
    process.exit(1);
}

// --- Tiny PNG decoder/encoder (RGBA only, no filtering) -----------------

function readChunks(buffer) {
    const chunks = [];
    let offset = 8; // skip PNG signature
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.slice(offset + 8, offset + 8 + length);
        chunks.push({ type, data });
        offset += 8 + length + 4; // length + type + data + crc
    }
    return chunks;
}

function decodePng(buffer) {
    const chunks = readChunks(buffer);
    const ihdr = chunks.find(c => c.type === "IHDR");
    if (!ihdr) throw new Error("No IHDR chunk");
    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    const bitDepth = ihdr.data[8];
    const colorType = ihdr.data[9];
    if (bitDepth !== 8) throw new Error("Unsupported bit depth: " + bitDepth);
    if (colorType !== 6 && colorType !== 2) {
        throw new Error("Unsupported color type (need 2 RGB or 6 RGBA): " + colorType);
    }
    const channels = colorType === 6 ? 4 : 3;

    const idat = Buffer.concat(chunks.filter(c => c.type === "IDAT").map(c => c.data));
    const raw = zlib.inflateSync(idat);

    // Defilter scanlines (filter byte + channels * width bytes per row)
    const stride = width * channels;
    const pixels = Buffer.alloc(stride * height);
    let prevRow = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const rowStart = y * (stride + 1) + 1;
        const row = Buffer.alloc(stride);
        for (let x = 0; x < stride; x++) {
            const left = x >= channels ? row[x - channels] : 0;
            const up = prevRow[x];
            const upLeft = x >= channels ? prevRow[x - channels] : 0;
            let value;
            switch (filter) {
                case 0: value = raw[rowStart + x]; break;
                case 1: value = raw[rowStart + x] + left; break;
                case 2: value = raw[rowStart + x] + up; break;
                case 3: value = raw[rowStart + x] + Math.floor((left + up) / 2); break;
                case 4: {
                    const p = left + up - upLeft;
                    const pa = Math.abs(p - left);
                    const pb = Math.abs(p - up);
                    const pc = Math.abs(p - upLeft);
                    const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
                    value = raw[rowStart + x] + pred;
                    break;
                }
                default: throw new Error("Unknown filter: " + filter);
            }
            row[x] = value & 0xff;
        }
        row.copy(pixels, y * stride);
        prevRow = row;
    }
    return { width, height, channels, pixels };
}

function crc32(buf) {
    let c;
    const table = crc32.table || (crc32.table = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })());
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
    return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, channels, pixels) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = channels === 4 ? 6 : 2;  // color type
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // Apply filter type 0 (None) to each scanline
    const stride = width * channels;
    const filtered = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        filtered[y * (stride + 1)] = 0;
        pixels.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
    }
    const idat = zlib.deflateSync(filtered);
    return Buffer.concat([
        signature,
        writeChunk("IHDR", ihdr),
        writeChunk("IDAT", idat),
        writeChunk("IEND", Buffer.alloc(0))
    ]);
}

function resize(srcPixels, srcW, srcH, channels, dstW, dstH) {
    // Nearest-neighbour resize — good enough for a square icon crop from
    // a banner. The source is centre-cropped to a square first.
    const dst = Buffer.alloc(dstW * dstH * channels);
    for (let y = 0; y < dstH; y++) {
        const srcY = Math.floor(y * srcH / dstH);
        for (let x = 0; x < dstW; x++) {
            const srcX = Math.floor(x * srcW / dstW);
            const srcOff = (srcY * srcW + srcX) * channels;
            const dstOff = (y * dstW + x) * channels;
            for (let c = 0; c < channels; c++) dst[dstOff + c] = srcPixels[srcOff + c];
        }
    }
    return dst;
}

function centreCropToSquare(pixels, width, height, channels) {
    const side = Math.min(width, height);
    const srcX = Math.floor((width - side) / 2);
    const srcY = Math.floor((height - side) / 2);
    const out = Buffer.alloc(side * side * channels);
    for (let y = 0; y < side; y++) {
        pixels.copy(out, y * side * channels,
            (srcY + y) * width * channels + srcX * channels,
            (srcY + y) * width * channels + (srcX + side) * channels);
    }
    return { pixels: out, width: side, height: side };
}

// --- Main ---------------------------------------------------------------

const input = fs.readFileSync(INPUT);
const { width, height, channels, pixels } = decodePng(input);
console.log("Decoded " + width + "x" + height + " (" + channels + " channels)");

const square = centreCropToSquare(pixels, width, height, channels);
const squarePixels = resize(square.pixels, square.width, square.height, channels, 1024, 1024);
fs.writeFileSync(OUT_SQUARE, encodePng(1024, 1024, channels, squarePixels));
console.log("Wrote " + OUT_SQUARE);

const iconPixels = resize(square.pixels, square.width, square.height, channels, 256, 256);
fs.writeFileSync(OUT_ICON, encodePng(256, 256, channels, iconPixels));
console.log("Wrote " + OUT_ICON);
