import { ApiError } from "./http.ts";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_000_000;

type AvatarInput = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};

export type ValidatedAvatar = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
};

const FORMATS = {
  jpg: { extension: "jpg", mimeType: "image/jpeg" },
  jpeg: { extension: "jpg", mimeType: "image/jpeg" },
  png: { extension: "png", mimeType: "image/png" },
  webp: { extension: "webp", mimeType: "image/webp" },
} as const;

function invalid(message = "头像文件无效，请选择 JPG、PNG 或 WebP 图片。"): never {
  throw new ApiError("INVALID_AVATAR", 400, message);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function parsePng(bytes: Uint8Array): { width: number; height: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value)) invalid();

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) invalid("头像图片结构损坏，请重新选择。");
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) invalid("头像图片结构损坏，请重新选择。");
      width = view.getUint32(offset + 8, false);
      height = view.getUint32(offset + 12, false);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const validDepth = ({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] } as Record<number, number[]>)[colorType]?.includes(bitDepth);
      if (!validDepth || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] > 1) invalid("头像图片结构损坏，请重新选择。");
      sawHeader = true;
    }
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.length) invalid("头像图片结构损坏，请重新选择。");
      sawEnd = true;
      break;
    }
    offset = end;
  }
  if (!sawHeader || !sawEnd) invalid("头像图片结构损坏，请重新选择。");
  return { width, height };
}

function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function parseJpeg(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalid();
  let offset = 2;
  let width = 0;
  let height = 0;
  let sawScan = false;
  let sawEnd = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      if (!sawScan) invalid("头像图片结构损坏，请重新选择。");
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      sawEnd = true;
      break;
    }
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) invalid("头像图片结构损坏，请重新选择。");
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) invalid("头像图片结构损坏，请重新选择。");
    if (isStartOfFrame(marker)) {
      if (length < 8) invalid("头像图片结构损坏，请重新选择。");
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
    }
    if (marker === 0xda) sawScan = true;
    offset += length;
  }
  if (!width || !height || !sawScan || !sawEnd) invalid("头像图片结构损坏，请重新选择。");
  return { width, height };
}

function uint24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseWebp(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) invalid("头像图片结构损坏，请重新选择。");

  let offset = 12;
  let dimensions: { width: number; height: number } | null = null;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const end = dataOffset + length;
    if (end > bytes.length) invalid("头像图片结构损坏，请重新选择。");
    if (type === "VP8X" && length >= 10) {
      dimensions = { width: uint24le(bytes, dataOffset + 4) + 1, height: uint24le(bytes, dataOffset + 7) + 1 };
    } else if (type === "VP8 " && length >= 10 && bytes[dataOffset + 3] === 0x9d && bytes[dataOffset + 4] === 0x01 && bytes[dataOffset + 5] === 0x2a) {
      dimensions = {
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff,
      };
    } else if (type === "VP8L" && length >= 5 && bytes[dataOffset] === 0x2f) {
      const packed = view.getUint32(dataOffset + 1, true);
      dimensions = { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
    }
    offset = end + (length % 2);
  }
  if (offset !== bytes.length || !dimensions) invalid("头像图片结构损坏，请重新选择。");
  return dimensions;
}

export function validateAvatarBytes(input: AvatarInput): ValidatedAvatar {
  if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0) invalid();
  if (input.bytes.length > MAX_AVATAR_BYTES) invalid("头像文件不能超过 2MB。");
  if (typeof input.fileName !== "string" || typeof input.contentType !== "string") invalid();

  const match = input.fileName.trim().match(/\.([a-z0-9]+)$/i);
  const format = match ? FORMATS[match[1].toLowerCase() as keyof typeof FORMATS] : undefined;
  if (!format || input.contentType.trim().toLowerCase() !== format.mimeType) invalid();

  const dimensions = format.extension === "png"
    ? parsePng(input.bytes)
    : format.extension === "webp"
    ? parseWebp(input.bytes)
    : parseJpeg(input.bytes);
  if (dimensions.width <= 0 || dimensions.height <= 0) invalid("无法读取头像图片尺寸。");
  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) invalid("头像图片尺寸不能超过 4096×4096。");
  if (dimensions.width * dimensions.height >= MAX_PIXELS) invalid("头像图片像素过大，请压缩后重试。");

  return { ...format, ...dimensions };
}
